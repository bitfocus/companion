import type {
	ClientDevicesListItem,
	OutboundSurfaceInfo,
	SurfacesUpdate,
	OutboundSurfacesUpdate,
	ClientSurfaceItem,
} from '@companion-app/shared/Model/Surfaces.js'
import { action, observable } from 'mobx'
import { assertNever } from '~/util.js'
import { applyPatch } from 'fast-json-patch'
import { cloneDeep } from 'lodash-es'
import { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'

export class SurfacesStore {
	readonly store = observable.map<string, ClientDevicesListItem>()

	readonly outboundSurfaces = observable.map<string, OutboundSurfaceInfo>()

	public resetSurfaces = action((newData: Record<string, ClientDevicesListItem | undefined> | null): void => {
		this.store.clear()

		if (newData) {
			for (const [id, item] of Object.entries(newData)) {
				if (item) {
					this.store.set(id, item)
				}
			}
		}
	})

	public applySurfacesChange = action((change: SurfacesUpdate) => {
		const changeType = change.type
		switch (change.type) {
			case 'add':
				this.store.set(change.itemId, change.info)
				break
			case 'remove':
				this.store.delete(change.itemId)
				break
			case 'update': {
				const oldObj = this.store.get(change.itemId)
				if (!oldObj) throw new Error(`Got update for unknown surface item: ${change.itemId}`)
				const newObj = applyPatch(cloneDeep(oldObj), change.patch)
				this.store.set(change.itemId, newObj.newDocument)
				break
			}
			default:
				console.error(`Unknown surfaces change change: ${changeType}`)
				assertNever(change)
				break
		}
	})

	public resetOutboundSurfaces = action((newData: Record<string, OutboundSurfaceInfo | undefined> | null): void => {
		this.outboundSurfaces.clear()

		if (newData) {
			for (const [id, item] of Object.entries(newData)) {
				if (item) {
					this.outboundSurfaces.set(id, item)
				}
			}
		}
	})

	public applyOutboundSurfacesChange = action((change: OutboundSurfacesUpdate) => {
		const changeType = change.type
		switch (change.type) {
			case 'add':
				this.outboundSurfaces.set(change.itemId, change.info)
				break
			case 'remove':
				this.outboundSurfaces.delete(change.itemId)
				break
			default:
				console.error(`Unknown remote surfaces change change: ${changeType}`)
				assertNever(change)
				break
		}
	})

	public getOutboundStreamDeckSurface = (address: string, port: number): OutboundSurfaceInfo | undefined => {
		for (const surface of this.outboundSurfaces.values()) {
			if (surface.type === 'elgato' && surface.address === address && (surface.port ?? 5343) === port) {
				return surface
			}
		}
		return undefined
	}

	public getSurfacesOverflowingBounds = (
		bounds: UserConfigGridSize
	): { neededBounds: UserConfigGridSize; surfaces: ClientSurfaceItem[] } => {
		const neededBounds: UserConfigGridSize = { ...bounds }
		const overflowingSurfaces: ClientSurfaceItem[] = []

		for (const group of this.store.values()) {
			for (const surface of group.surfaces) {
				if (!surface.size || !surface.offset) continue

				// Determine the size, after rotation
				let { rows, columns } = surface.size
				if (surface.rotation === 'surface-90' || surface.rotation === 'surface90') {
					const tmp = rows
					rows = columns
					columns = tmp
				}

				const minX = surface.offset.columns
				const minY = surface.offset.rows
				const maxX = minX + columns - 1
				const maxY = minY + rows - 1

				if (minX < bounds.minColumn || minY < bounds.minRow || maxX > bounds.maxColumn || maxY > bounds.maxRow) {
					overflowingSurfaces.push(surface)

					neededBounds.minColumn = Math.min(neededBounds.minColumn, minX)
					neededBounds.maxColumn = Math.max(neededBounds.maxColumn, maxX)
					neededBounds.minRow = Math.min(neededBounds.minRow, minY)
					neededBounds.maxRow = Math.max(neededBounds.maxRow, maxY)
				}
			}
		}

		return {
			neededBounds,
			surfaces: overflowingSurfaces,
		}
	}

	public countFirmwareUpdates(): number {
		let count = 0

		for (const group of this.store.values()) {
			for (const surface of group.surfaces) {
				if (surface.hasFirmwareUpdates) {
					count++
				}
			}
		}

		return count
	}
}
