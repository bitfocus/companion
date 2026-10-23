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
import type { IControlStore } from '../../../lib/Controls/IControlStore.js'
import type { DataUserConfig } from '../../../lib/Data/UserConfig.js'
import type { GraphicsController } from '../../../lib/Graphics/Controller.js'
import { DisplayedLocations } from '../../../lib/Graphics/DisplayedLocations.js'
import type { ImageResult } from '../../../lib/Graphics/ImageResult.js'
import type { LinkButtonTarget } from '../../../lib/Link/ButtonClient.js'
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
 * serves (every location has a button, drawn as `<name>-<location>`, pressed through `controls`), which locations of
 * its pages hold a remote button (`placeRemoteButton`), what is shown where (`displayedLocations`), and its user
 * config
 */
export class LinkInstallation {
	readonly name: string
	readonly controller: LinkController
	readonly displayedLocations = new DisplayedLocations()
	/** The aborts of the actions of each control */
	readonly abortControl = vi.fn((_controlId: string, _unlatch: boolean, _hops: number) => undefined)
	readonly controls = {
		pressControl: vi.fn((_controlId: string, _pressed: boolean, _surfaceId: string | undefined) => true),
		rotateControl: vi.fn((_controlId: string, _delta: number, _surfaceId: string | undefined) => true),
		getControl: vi.fn(
			(controlId: string) =>
				({
					abortDelayedActions: (unlatch: boolean, _except: unknown, hops: number) =>
						this.abortControl(controlId, unlatch, hops),
				}) as any
		),
	}
	readonly graphics = {
		getCachedRenderOrGeneratePlaceholder: vi.fn((location: ControlLocation) =>
			fakeRender(`${this.name}-${locationKey(location)}`, false)
		),
		displayedLocations: this.displayedLocations,
	}
	/** Link's tRPC api, called as the UI would */
	readonly api: LinkApi

	/** The control at each location that is a remote button */
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
		// Every location has a button, a remote button where one has been placed
		const pageStore = Object.assign(new EventEmitter(), {
			getControlIdAt: (location: ControlLocation) =>
				this.#controlsAt.get(locationKey(location)) ?? `control-${locationKey(location)}`,
		}) as unknown as IPageStore

		this.controller = new LinkController(
			{ appVersion: '5.2.0' } as any,
			db.asDataDatabase(),
			userconfig,
			// Only what Link uses
			{
				pageStore,
				controls: this.controls as unknown as IControlStore,
				graphics: this.graphics as unknown as GraphicsController,
			},
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

	/** Point a remote button placed here at a button of a peer, telling it the sizes it is shown at as the control does */
	targetRemoteButton(controlId: string, target: LinkButtonTarget): void {
		this.controller.buttonClient.setTarget(controlId, target, () => undefined)

		for (const [key, placed] of this.#controlsAt) {
			if (placed !== controlId) continue
			const [pageNumber, row, column] = key.split('/').map(Number)
			this.controller.buttonClient.setDisplayedSizes(
				controlId,
				this.displayedLocations.getSizes({ pageNumber, row, column })
			)
		}
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
