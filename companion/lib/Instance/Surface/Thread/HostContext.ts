import type {
	CheckDeviceResult,
	HostCapabilities,
	HostSurfaceEvents,
	OpenDeviceResult,
	SurfaceHostContext,
	SurfaceFirmwareUpdateInfo,
	DiscoveredRemoteSurfaceInfo,
	ShouldOpenSurfaceResult,
} from '@companion-surface/host'
import type { SurfaceIpcWrapper } from '../IpcTypes.js'
import { LockingGraphicsGeneratorImpl } from './LockingGraphics.js'
import { CardGenerator } from './Cards.js'
import { convertOpenDeviceResult } from './Util.js'

/**
 * The context of methods and properties provided to the surfaces, which they can use to report events or make requests.
 */
export class HostContext implements SurfaceHostContext {
	readonly #ipcWrapper: SurfaceIpcWrapper

	readonly lockingGraphics = new LockingGraphicsGeneratorImpl()
	readonly cardsGenerator = new CardGenerator()

	readonly capabilities: HostCapabilities = {}

	readonly surfaceEvents: HostSurfaceEvents

	constructor(ipcWrapper: SurfaceIpcWrapper) {
		this.#ipcWrapper = ipcWrapper

		this.surfaceEvents = {
			disconnected: (surfaceId: string) => {
				this.#ipcWrapper.sendWithNoCb('disconnect', { surfaceId, reason: null })
			},
			inputPress: (surfaceId: string, controlId: string, pressed: boolean) => {
				this.#ipcWrapper.sendWithNoCb('input-press', { surfaceId, controlId, pressed })
			},
			inputRotate: (surfaceId: string, controlId: string, delta: number) => {
				this.#ipcWrapper.sendWithNoCb('input-rotate', { surfaceId, controlId, delta })
			},
			changePage: (surfaceId: string, forward: boolean) => {
				this.#ipcWrapper.sendWithNoCb('change-page', { surfaceId, forward })
			},
			setVariableValue: (surfaceId: string, name: string, value: any) => {
				this.#ipcWrapper.sendWithNoCb('set-variable-value', { surfaceId, name, value })
			},
			pincodeEntry: (surfaceId: string, char: number) => {
				this.#ipcWrapper.sendWithNoCb('pincode-entry', { surfaceId, keycode: char })
			},
			firmwareUpdateInfo: (surfaceId: string, updateInfo: SurfaceFirmwareUpdateInfo | null) => {
				this.#ipcWrapper.sendWithNoCb('firmware-update-info', { surfaceId, updateInfo })
			},
		}
	}

	readonly shouldOpenDiscoveredSurface = async (info: CheckDeviceResult): Promise<ShouldOpenSurfaceResult> => {
		const result = await this.#ipcWrapper.sendWithCb('shouldOpenDiscoveredSurface', { info })

		return {
			shouldOpen: result.shouldOpen,
			resolvedSurfaceId: result.resolvedSurfaceId,
		}
	}
	readonly notifyOpenedDiscoveredSurface = async (info: OpenDeviceResult): Promise<void> => {
		this.#ipcWrapper.sendWithNoCb('notifyOpenedDiscoveredDevice', {
			info: convertOpenDeviceResult(info),
		})
	}

	readonly forgetDiscoveredSurfaces = (devicePaths: string[]): void => {
		this.#ipcWrapper.sendWithNoCb('forgetDiscoveredSurfaces', { devicePaths })
	}

	readonly connectionsFound = (connectionInfos: DiscoveredRemoteSurfaceInfo[]): void => {
		this.#ipcWrapper.sendWithNoCb('notifyConnectionsFound', { connectionInfos })
	}
	readonly connectionsForgotten = (connectionIds: string[]): void => {
		this.#ipcWrapper.sendWithNoCb('notifyConnectionsForgotten', { connectionIds })
	}
}
