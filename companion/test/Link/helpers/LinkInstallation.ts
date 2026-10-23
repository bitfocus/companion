import { EventEmitter } from 'node:events'
import { vi } from 'vitest'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type {
	LinkPeerInfo,
	LinkSelfInfo,
	LinkTransportConfig,
	LinkTransportState,
} from '@companion-app/shared/Model/Link.js'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import type { DataUserConfig } from '../../../lib/Data/UserConfig.js'
import type { ImageResult } from '../../../lib/Graphics/ImageResult.js'
import { LinkController } from '../../../lib/Link/Controller.js'
import type { SomeLinkBuiltinTransport, SomeLinkTransportDefinition } from '../../../lib/Link/Transports/Types.js'
import type { IPageStore } from '../../../lib/Page/Store.js'
import { FakeDataDatabase } from '../../utils/FakeTableView.js'

/** A render of a button, whose image says which installation drew it and which version it is */
export function fakeRender(image: string, pushed: boolean): ImageResult {
	return {
		style: { type: 'button', state: { pushed } },
		drawNativeEncoded: async () => `data:image/png;base64,${image}`,
	} as unknown as ImageResult
}

/** The tRPC api of Link, called directly as the UI would */
export type LinkApi = ReturnType<ReturnType<LinkController['createTrpcRouter']>['createCaller']>

function locationKey(location: ControlLocation): string {
	return `${location.pageNumber}/${location.row}/${location.column}`
}

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

/**
 * A Companion installation running a real LinkController, with fakes of the rest of Companion: the buttons it
 * serves (`host`, every location has a button, drawn as `<name>-<location>`), which locations of its pages hold a
 * remote button (`placeRemoteButton`), and its user config
 */
export class LinkInstallation {
	readonly name: string
	readonly controller: LinkController
	readonly host = {
		getCachedRenderOrGeneratePlaceholder: vi.fn((location: ControlLocation) =>
			fakeRender(`${this.name}-${locationKey(location)}`, false)
		),
		getControlIdAt: vi.fn((location: ControlLocation) => `control-${locationKey(location)}`),
		pressControl: vi.fn((_controlId: string, _pressed: boolean, _surfaceId: string) => true),
		rotateControl: vi.fn((_controlId: string, _delta: number, _surfaceId: string) => true),
		abortControl: vi.fn((_controlId: string, _unlatch: boolean, _hops: number) => undefined),
	}
	/** Link's tRPC api, called as the UI would */
	readonly api: LinkApi

	/** The control at each location that is a remote button, for loop detection */
	readonly #controlsAt = new Map<string, string>()

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
		const pageStore = Object.assign(new EventEmitter(), {
			getControlIdAt: (location: ControlLocation) => this.#controlsAt.get(locationKey(location)) ?? null,
		}) as unknown as IPageStore

		this.controller = new LinkController(
			{ appVersion: '5.2.0' } as any,
			db.asDataDatabase(),
			userconfig,
			pageStore,
			this.host,
			options.transportDefinitions,
			options.builtinTransports
		)
		this.api = this.#caller(undefined)
	}

	#caller(signal: AbortSignal | undefined): LinkApi {
		return this.controller.createTrpcRouter().createCaller({} as any, { signal })
	}

	/** Mark a location as holding a remote button, as the page store would */
	placeRemoteButton(location: ControlLocation, controlId: string): void {
		this.#controlsAt.set(locationKey(location), controlId)
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
