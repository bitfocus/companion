import type { Logger } from '../../../Log/Controller.js'
import {
	commitPairingNonce,
	createPairingNonce,
	derivePairingCode,
	normalisePairingCode,
	parseAuthFrame,
	type AuthFrame,
} from './Pairing.js'
import type { SecureChannel } from './SecureChannel.js'

/** How long the other end may take to answer, while nothing is waiting for the user */
const EXCHANGE_TIMEOUT_MS = 10_000
/** How long a pairing request waits for the user */
const PAIRING_TIMEOUT_MS = 5 * 60 * 1000
/** Wrong codes allowed before a pairing request is rejected */
const PAIRING_MAX_ATTEMPTS = 3

/** What the accepting end of a channel needs to authenticate it */
export interface AcceptingAuthHost {
	readonly logger: Logger
	/** Whether this end has paired with the installation */
	isPaired(linkId: string): boolean
	/** Whether another pairing request may wait for the user, so that they can't be used to flood the UI */
	canRequestPairing(): boolean
	/** The user must pair the other end, by entering the code it shows into the request */
	requestPairing(request: PairingRequest): void
	/** The channel is trusted: exchange Link messages over it. `newlyPaired` when the user has just paired it */
	trusted(channel: SecureChannel, newlyPaired: boolean): void
}

/**
 * Authenticate a channel from an installation that connected to this one: trust it if they are paired, or ask the user
 * to pair it. See the README for how pairing works
 */
export function acceptAuthentication(channel: SecureChannel, host: AcceptingAuthHost): void {
	const timeout = setTimeout(() => channel.close(), EXCHANGE_TIMEOUT_MS)
	channel.onClose(() => clearTimeout(timeout))

	channel.setHandler((text) => {
		clearTimeout(timeout)
		const frame = parseAuthFrame(text)
		if (frame?.op !== 'auth-request') {
			channel.close()
			return
		}

		// Asked to pair whenever the other end hasn't, even if this end remembers it, as it only trusts an end it has
		// paired with
		if (frame.paired && host.isPaired(channel.remoteLinkId)) {
			sendFrame(channel, { op: 'auth', status: 'paired' })
			host.trusted(channel, false)
		} else if (!host.canRequestPairing()) {
			host.logger.warn(`Refusing pairing request from ${channel.remoteName}, too many are waiting`)
			rejectChannel(channel)
		} else {
			startPairing(channel, host)
		}
	})
}

/** Exchange nonces commit-then-reveal, then wait for the user to enter the code */
function startPairing(channel: SecureChannel, host: AcceptingAuthHost): void {
	const nonce = createPairingNonce()
	const timeout = setTimeout(() => channel.close(), EXCHANGE_TIMEOUT_MS)
	channel.onClose(() => clearTimeout(timeout))

	// Nothing else is accepted from an unpaired installation
	let requested = false
	channel.setHandler((text) => {
		const frame = parseAuthFrame(text)
		if (frame?.op !== 'pairing-nonce' || requested) {
			channel.close()
			return
		}
		clearTimeout(timeout)
		requested = true

		const request = new PairingRequest(channel, derivePairingCode(channel.handshakeHash, nonce, frame.nonce), host)
		sendFrame(channel, { op: 'pairing-reveal', nonce })
		host.requestPairing(request)
	})

	sendFrame(channel, { op: 'pairing-commit', commit: commitPairingNonce(nonce) })
}

/** A pairing request, waiting for the user to enter the code the other end shows */
export class PairingRequest {
	readonly channel: SecureChannel

	readonly #expectedCode: string
	readonly #host: AcceptingAuthHost
	readonly #timeout: NodeJS.Timeout
	readonly #endListeners: (() => void)[] = []
	#attempts = 0
	#ended = false

	constructor(channel: SecureChannel, expectedCode: string, host: AcceptingAuthHost) {
		this.channel = channel
		this.#expectedCode = expectedCode
		this.#host = host
		this.#timeout = setTimeout(() => this.reject(), PAIRING_TIMEOUT_MS)
		channel.onClose(() => this.#end())
	}

	/** Be told when it stops waiting: paired, rejected, timed out, or the connection closed */
	onEnd(listener: () => void): void {
		this.#endListeners.push(listener)
	}

	/** Check a code the user entered. Too many wrong ones reject the request */
	enterCode(code: string): 'paired' | 'wrong' | 'rejected' {
		if (this.#ended) return 'rejected'

		if (normalisePairingCode(code) !== normalisePairingCode(this.#expectedCode)) {
			this.#attempts++
			if (this.#attempts < PAIRING_MAX_ATTEMPTS) return 'wrong'
			this.reject()
			return 'rejected'
		}

		this.#end()
		sendFrame(this.channel, { op: 'auth', status: 'paired' })
		this.#host.trusted(this.channel, true)
		return 'paired'
	}

	reject(): void {
		if (this.#ended) return
		this.#end()
		rejectChannel(this.channel)
	}

	#end(): void {
		if (this.#ended) return
		this.#ended = true
		clearTimeout(this.#timeout)
		for (const listener of this.#endListeners) listener()
	}
}

/** What the connecting end of a channel needs to authenticate it */
export interface ConnectingAuthHost {
	readonly logger: Logger
	/** Whether this end has paired with the other one */
	readonly paired: boolean
	/** The user must enter this code into the pairing request on the other installation */
	showCode(code: string): void
	/** The other end trusts this one: exchange Link messages over the channel */
	trusted(): void
	/**
	 * Retrying wouldn't help: the user rejected the pairing (`rejected`), or the other end claimed a pairing that never
	 * happened (`not-paired`)
	 */
	refused(reason: 'rejected' | 'not-paired'): void
}

/**
 * Authenticate a channel this installation opened: say whether it has paired with the other end, and pair if asked
 * to. See the README for how pairing works
 */
export function requestAuthentication(channel: SecureChannel, host: ConnectingAuthHost): void {
	/** The commitment of the other end to its nonce, the nonce sent in answer, and the code once it is known */
	let commit: string | null = null
	let nonce: string | null = null
	let code: string | null = null
	const invalid = (reason: string) => {
		host.logger.warn(`Invalid message while pairing: ${reason}`)
		channel.close()
	}

	channel.setHandler((text) => {
		const frame = parseAuthFrame(text)
		if (!frame) return invalid('not an auth message')

		switch (frame.op) {
			case 'auth-request':
				return invalid('an auth request from the accepting end')
			case 'pairing-nonce':
				return invalid('a nonce from the accepting end')
			case 'pairing-commit':
				if (commit) return invalid('a second commitment')
				commit = frame.commit
				nonce = createPairingNonce()
				sendFrame(channel, { op: 'pairing-nonce', nonce })
				return
			case 'pairing-reveal':
				if (!commit || !nonce || code) return invalid('an unexpected reveal')
				if (commitPairingNonce(frame.nonce) !== commit) return invalid('the nonce does not match its commitment')
				code = derivePairingCode(channel.handshakeHash, frame.nonce, nonce)
				host.showCode(code)
				return
		}

		switch (frame.status) {
			case 'paired':
				// Something impersonating the other installation could claim they are paired, so only trust it if they are
				if (!host.paired && !code) {
					host.refused('not-paired')
					channel.close()
					return
				}
				host.trusted()
				return
			case 'rejected':
				host.refused('rejected')
				channel.close()
				return
		}
	})

	sendFrame(channel, { op: 'auth-request', paired: host.paired })
}

function sendFrame(channel: SecureChannel, frame: AuthFrame): void {
	channel.send(JSON.stringify(frame))
}

function rejectChannel(channel: SecureChannel): void {
	sendFrame(channel, { op: 'auth', status: 'rejected' })
	channel.close()
}
