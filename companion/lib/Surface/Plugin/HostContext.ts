import type { HostCapabilities, HostSurfaceEvents, SurfaceHostContext } from '@companion-surface/base/host'
import type { SurfaceIpcWrapper } from './IpcTypes.js'
import { LockingGraphicsGeneratorImpl } from './LockingGraphics.js'
import { CardGenerator } from './Cards.js'

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
				console.log(`Plugin surface disconnected: ${surfaceId}`)

				// TODO - something?
			},
			inputPress: (surfaceId: string, controlId: string, pressed: boolean) => {
				this.#ipcWrapper.sendWithNoCb('input-press', { surfaceId, controlId, pressed })
			},
			inputRotate: (surfaceId: string, controlId: string, delta: number) => {
				this.#ipcWrapper.sendWithNoCb('input-rotate', { surfaceId, controlId, delta })
			},
			setVariableValue: (surfaceId: string, name: string, value: any) => {
				this.#ipcWrapper.sendWithNoCb('set-variable-value', { surfaceId, name, value })
			},
			pincodeEntry: (surfaceId: string, char: number) => {
				this.#ipcWrapper.sendWithNoCb('pincode-entry', { surfaceId, keycode: char })
			},
		}
	}
}
