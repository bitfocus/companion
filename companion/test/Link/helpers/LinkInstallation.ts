import { EventEmitter } from 'node:events'
import type {
	LinkPeerInfo,
	LinkSelfInfo,
	LinkTransportConfig,
	LinkTransportState,
} from '@companion-app/shared/Model/Link.js'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import type { DataUserConfig } from '../../../lib/Data/UserConfig.js'
import { LinkController } from '../../../lib/Link/Controller.js'
import type { SomeLinkBuiltinTransport, SomeLinkTransportDefinition } from '../../../lib/Link/Transports/Types.js'
import { FakeDataDatabase } from '../../utils/FakeTableView.js'

/** The tRPC api of Link, called directly as the UI would */
export type LinkApi = ReturnType<ReturnType<LinkController['createTrpcRouter']>['createCaller']>

export interface LinkInstallationOptions {
	name: string
	transportDefinitions: readonly SomeLinkTransportDefinition[]
	builtinTransports: readonly SomeLinkBuiltinTransport[]
	/** Transports to have configured from the start, as if added before a restart */
	transports: readonly Omit<LinkTransportConfig, 'sortOrder' | 'builtin'>[]
	userConfig: Partial<UserConfigModel>
}

/** The first value of a subscription, which is the current state */
async function current<T>(subscribe: (signal: AbortSignal) => Promise<AsyncIterable<T>>): Promise<T> {
	const abort = new AbortController()
	try {
		const iterable = await subscribe(abort.signal)
		const first = await iterable[Symbol.asyncIterator]().next()
		return first.value as T
	} finally {
		abort.abort()
	}
}

/** A Companion installation running a real LinkController, with a fake of its user config */
export class LinkInstallation {
	readonly name: string
	readonly controller: LinkController
	/** Link's tRPC api, called as the UI would */
	readonly api: LinkApi

	constructor(options: LinkInstallationOptions) {
		this.name = options.name

		const db = new FakeDataDatabase()
		options.transports.forEach((transport, sortOrder) => {
			db.getTableView('link_transports').data[transport.id] = { ...transport, sortOrder, builtin: false }
		})

		const userConfigValues: Partial<UserConfigModel> = { installName: options.name, ...options.userConfig }
		const userconfig = Object.assign(new EventEmitter(), {
			getKey: (key: keyof UserConfigModel) => userConfigValues[key],
		}) as unknown as DataUserConfig

		this.controller = new LinkController(
			{ appVersion: '5.2.0' } as any,
			db.asDataDatabase(),
			userconfig,
			options.transportDefinitions,
			options.builtinTransports
		)
		this.api = this.#caller(undefined)
	}

	#caller(signal: AbortSignal | undefined): LinkApi {
		return this.controller.createTrpcRouter().createCaller({} as any, { signal })
	}

	async self(): Promise<LinkSelfInfo> {
		return current(async (signal) => this.#caller(signal).watchSelf())
	}

	async peers(): Promise<LinkPeerInfo[]> {
		return current(async (signal) => this.#caller(signal).watchPeers())
	}

	async transportStates(): Promise<Record<string, LinkTransportState>> {
		const update = await current(async (signal) => this.#caller(signal).watchTransportStates())
		return update.type === 'init' ? update.items : {}
	}

	start(): void {
		this.controller.start()
	}

	async stop(): Promise<void> {
		await this.controller.stop()
	}
}
