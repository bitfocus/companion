/*
 * This file is part of the Companion project
 * Copyright (c) 2021 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 */

import SCClient from 'socketcluster-client'
import isEqual from 'fast-deep-equal'
import { delay } from '../Resources/Util.js'
import LogController, { Logger } from '../Log/Controller.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { CloudController, CloudUIEvents } from './Controller.js'
import type EventEmitter from 'node:events'

/**
 * Functionality for a connection region for cloud control
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @since 2.3.0
 */
export class CloudRegion {
	/**
	 * The logger for this class
	 */
	readonly #logger: Logger

	/**
	 * The host of the remote server
	 */
	#host: string = ''
	/**
	 * The unique ID of this region
	 */
	#id: string = ''

	/**
	 * The state object for the UI
	 */
	state: CloudRegionState = {
		connected: false,
		enabled: false,
		loginRetry: -1,
		error: '',
		id: '',
		name: '',
		pingResults: -1,
		cloudActive: false,
	}

	readonly #cloud: CloudController

	readonly #events: EventEmitter<CloudUIEvents>

	#socket: SCClient.AGClientSocket | undefined

	/**
	 * Setup a Bitfocus Cloud region
	 * @param cloud - the cloud controller
	 * @param id - this unique ID
	 * @param data - setup data for the region
	 */
	constructor(
		cloud: CloudController,
		events: EventEmitter<CloudUIEvents>,
		id: string,
		data: { host: string; name: string }
	) {
		this.#cloud = cloud
		this.#events = events
		this.#logger = LogController.createLogger(`Cloud/${id}`)

		this.#id = id
		this.state.id = id

		if (data.host) {
			this.#host = data.host
		} else {
			throw 'Host not defined'
		}

		if (data.name) {
			this.state.name = data.name
		} else {
			throw 'Name not defined'
		}
	}

	/**
	 * Process a <code>getBanks</code> call from a remote client
	 */
	async #clientGetBanks(): Promise<object> {
		this.#logger.silly('Client requested getBanks()')
		return this.#cloud.getBanks()
	}

	/**
	 * Process a <code>pushBank</code> call from a remote client
	 */
	async #clientPushBank(args: any): Promise<boolean> {
		const location: ControlLocation = args.location

		this.#logger.silly(`Client requested pushBank(${JSON.stringify(args)})`)

		// TODO: Deprecated: remove
		if (args.bank && args.page) {
			const controlId = this.#cloud.pageStore.getControlIdAtOldBankIndex(args.page, args.bank)
			if (controlId) {
				this.#cloud.controls.pressControl(controlId, true, 'cloud')
			}
		} else if (location) {
			const controlId = this.#cloud.pageStore.getControlIdAt(location)
			if (controlId) {
				this.#cloud.controls.pressControl(controlId, true, 'cloud')
			}
		}
		return true
	}

	/**
	 * Process a <code>releaseBank</code> call from a remote client
	 */
	async #clientReleaseBank(args: any): Promise<boolean> {
		const location: ControlLocation = args.location

		this.#logger.silly(`Client requested releaseBank(${JSON.stringify(args)})`)

		// TODO: Deprecated: remove
		if (args.bank && args.page) {
			const controlId = this.#cloud.pageStore.getControlIdAtOldBankIndex(args.page, args.bank)
			if (controlId) {
				this.#cloud.controls.pressControl(controlId, false, 'cloud')
			}
		} else if (location) {
			const controlId = this.#cloud.pageStore.getControlIdAt(location)
			if (controlId) {
				this.#cloud.controls.pressControl(controlId, false, 'cloud')
			}
		}
		return true
	}

	/**
	 * Authenticate companion server client
	 *
	 * NB: This function does not throw errors
	 */
	async #clientAuthenticate(): Promise<void> {
		try {
			if (!this.#socket) throw new Error('No socket')

			await this.#socket.invoke('cloudLogin', {
				token: this.#cloud.data.token,
				uuid: this.#cloud.state.uuid,
				companionId: this.#cloud.companionId,
				version: this.#cloud.appInfo.appBuild,
			})
			this.#logger.debug('Login ok')

			this.setState({ connected: true, error: '' })
			try {
				await this.#transmitFull()
			} catch (e: any) {
				if (this.isEnabled) {
					this.#logger.error(`Error transmitting full state: ${e.message}`)
				}
			}
		} catch (e: any) {
			if (this.isEnabled) {
				this.#logger.error(`Error logging into cloud: ${e.message}, retrying`)
				this.setState({ connected: false, error: e.message, loginRetry: 5 })
			}
		}
	}

	/**
	 * Connect to the cloud service
	 */
	async #cloudConnect(): Promise<void> {
		this.#logger.debug('Connecting')

		if (this.#socket !== undefined) {
			this.destroy()
		}

		this.#socket = SCClient.create({
			hostname: this.#host,
			secure: !this.#host.match(/^127\./),
			autoReconnectOptions: {
				initialDelay: 1000, //milliseconds
				randomness: 500, //milliseconds
				multiplier: 1.5, //decimal
				maxDelay: 20000, //milliseconds
			},
		})
		;(async () => {
			while (this.#socket) {
				for await (let _event of this.#socket.listener('connect')) {
					// eslint-disable-line
					this.#logger.debug('Socket is connected')

					if (this.#cloud.state.uuid === '') {
						this.#logger.error('Error logging into cloud: Error fetching unique machine id')
						return
					}

					this.#clientAuthenticate()
				}
				await delay(1000)
				//this.logger.silly('Are we still connected?')
			}
		})()
		;(async () => {
			while (this.#socket) {
				for await (let _event of this.#socket.listener('authenticate')) {
					// In case a client is already listening
					if (this.#socket.authState !== 'authenticated') {
						this.#logger.error(`Connection lost authentication, retrying`)
						this.setState({ connected: false, error: 'Authentication issues, retrying', loginRetry: 5 })
					}
				}
			}
		})()
		;(async () => {
			while (this.#socket) {
				for await (let event of this.#socket.listener('error')) {
					// @ts-expect-error unknown property
					if (event.error.code === 4401) {
						// Disconnected by another process with the same id, let us disable this cloud instance,
						// to prevent connection looping
						this.#logger.error(
							`Disconnected from cloud by another instance from this computer, disabled cloud region ${this.state.name}`
						)
						this.setState({
							enabled: false,
							connected: false,
							pingResults: -1,
							error: 'Disconnected from cloud by another instance from this computer',
						})
					} else {
						this.setState({
							connected: false,
							pingResults: -1,
							error: '',
						})
					}
				}
			}
		})()

		this.#registerCompanionProcs(this.#socket, 'allbanks', this.#clientGetBanks.bind(this))
		this.#registerCompanionProcs(this.#socket, 'push', this.#clientPushBank.bind(this))
		this.#registerCompanionProcs(this.#socket, 'release', this.#clientReleaseBank.bind(this))
		this.#registerCompanionProcs(this.#socket, 'ping', this.#clientPing.bind(this))
	}

	/**
	 * Process a <code>ping</code> call from a remote client
	 */
	async #clientPing(): Promise<boolean> {
		return true
	}

	/**
	 * Disconnect the cloud socket and cleanup
	 */
	destroy(): void {
		/* TODO: add disable procedure */
		if (this.#socket !== undefined) {
			this.#socket.disconnect()
			this.#socket = undefined
			this.setState({ connected: false, pingResults: -1, error: '' })
		}

		this.#logger.silly(`destroy(${this.#id})`)
	}

	/**
	 * Associate a callback with a remote call
	 * @param socket - the cloud connection
	 * @param name - name of the remote call to trigger processing
	 * @param callback - function to process the remote data
	 */
	#registerCompanionProcs(socket: SCClient.AGClientSocket, name: string, callback: (...args: any[]) => Promise<any>) {
		if (typeof callback === 'function') {
			;(async () => {
				for await (let data of socket.subscribe(`companionProc:${this.#cloud.state.uuid}:${name}`, {
					waitForAuth: true,
				})) {
					if (this.#cloud.knownIds.has(data.callerId)) {
						// Already handled
						//this.logger.debug('Ignored redundant message %o', data.callerId)
						continue
					}
					this.#cloud.knownIds.set(data.callerId, Date.now())

					this.#logger.silly(`Received RPC for ${name}`)
					try {
						const result = await callback(...data.args)
						await socket.invokePublish('companionProcResult:' + data.callerId, { result: result })
						this.#logger.silly(`rpc result: companionProcResult:${data.callerId} : ${result}`)
					} catch (e: any) {
						if (this.isEnabled) {
							try {
								await socket.invokePublish('companionProcResult:' + data.callerId, { error: e.message })
							} catch (e) {}
						}
					}

					// Clean up known ids once in a while
					const now = Date.now()
					if (now - this.#cloud.lastKnownIdCleanup > 300000) {
						this.#cloud.lastKnownIdCleanup = now
						for (const [id, lastSeen] of this.#cloud.knownIds.entries()) {
							if (now - lastSeen > 300000) {
								this.#cloud.knownIds.delete(id)
							}
						}
					}
				}
			})()
		}
	}

	/**
	 * Merge and transmit new state information
	 * @param draftState - the updated state(s)
	 */
	setState(draftState: Partial<CloudRegionState>): void {
		const newState: CloudRegionState = {
			...this.state,
			...draftState,
		}

		if ((!newState.enabled || !newState.cloudActive) && draftState.error) {
			// Don't save error when disabled
			newState.error = null
		}

		let abortState = false

		if (this.#cloud.data.token) {
			if (this.state.enabled != newState.enabled) {
				this.#cloud.saveConnection(this.#id, newState.enabled)
			}

			if (this.state.cloudActive && !newState.cloudActive) {
				// Disabled cloud
				if (this.state.enabled && this.#cloud.state.authenticated) {
					this.state = newState
					this.#events.emit(`regionState:${this.#id}`, newState)
					this.destroy()
					abortState = true // already set state
				}
			} else if (!this.state.cloudActive && newState.cloudActive) {
				// Enabled cloud
				if (newState.enabled && this.#cloud.state.authenticated) {
					this.#cloudConnect()
				}
			}
		}

		if (!abortState) {
			if (!isEqual(newState, this.state)) {
				this.#events.emit(`regionState:${this.#id}`, newState)
			}

			this.state = newState
		}
	}

	/**
	 * Transmit information to the cloud service
	 */
	async socketTransmit(channelName: string, data: any): Promise<void> {
		if (this.#socket !== undefined) {
			try {
				await this.#socket.transmitPublish(channelName, data)
			} catch (e) {
				this.#logger.debug(`couldn't transmit to ${this.state.name}`)
			}
		}
	}

	/**
	 * Are we enabled and cloud is active?
	 * @returns true if enabled and cloud is active
	 */
	get isEnabled(): boolean {
		return this.state.enabled && this.state.cloudActive
	}

	/**
	 * Send a ping to the cloud service
	 */
	timerTick(): void {
		if (this.#socket !== undefined) {
			;(async () => {
				if (this.isEnabled && this.state.loginRetry >= 0) {
					this.setState({ loginRetry: this.state.loginRetry - 1 })
					if (this.state.loginRetry === -1) {
						this.#clientAuthenticate()
					}
				}
				try {
					if (this.isEnabled && this.#socket && this.#socket.state == this.#socket.OPEN) {
						const startTime = Date.now()
						const result = await this.#socket.invoke('ping', startTime)

						if (result && this.isEnabled) {
							this.setState({ pingResults: Date.now() - result })
						}
					}
				} catch (e: any) {
					// Handle error
					if (this.state.enabled) {
						this.setState({ error: e.message })
						this.#logger.silly(`couldn't ping ${this.state.name}: ${e.message}`)
					}
				}
			})()
		}
	}

	/**
	 * Send the full bank database to the cloud service
	 */
	async #transmitFull(): Promise<void> {
		if (!this.#socket) throw new Error('No socket')
		await this.#socket.transmitPublish('companion-banks:' + this.#cloud.state.uuid, {
			type: 'full',
			data: this.#cloud.getBanks(),
		})
	}

	/**
	 * Update the region
	 * @param data - setup data for the region
	 */
	updateSetup(data: RegionInfo): void {
		if (data.name) {
			this.setState({ name: data.name })
		}

		if (data.host && this.#host !== data.host) {
			this.destroy()
			this.#host = data.host

			if (this.#cloud.state.authenticated && this.isEnabled) {
				this.#cloudConnect()
			}
		}
	}
}

export interface RegionInfo {
	host: string
	name: string
}

interface CloudRegionState {
	connected: boolean
	enabled: boolean
	loginRetry: number
	error: string | null
	id: string
	name: string
	pingResults: number
	cloudActive: boolean
}
