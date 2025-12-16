import type {
	ClientDevicesListItem,
	OutboundSurfaceInfo,
	SurfacesUpdate,
	OutboundSurfacesUpdate,
	ClientSurfaceItem,
	OutboundSurfaceCollection,
} from '@companion-app/shared/Model/Surfaces.js'
import { action, observable } from 'mobx'
import { assertNever } from '~/Resources/util.js'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import { applyJsonPatchInPlace, updateObjectInPlace } from './ApplyDiffToMap'

export class SurfacesStore {
	readonly store = observable.map<string, ClientDevicesListItem>()

	readonly outboundSurfaces = observable.map<string, OutboundSurfaceInfo>()
	readonly outboundSurfaceCollections = observable.map<string, OutboundSurfaceCollection>()

	public updateSurfaces = action((changes: SurfacesUpdate[] | null) => {
		if (!changes) {
			this.store.clear()
			return
		}

		for (const change of changes) {
			const changeType = change.type
			switch (change.type) {
				case 'init':
					this.store.replace(change.info)
					break
				case 'add':
					this.store.set(change.itemId, change.info)
					break
				case 'remove':
					this.store.delete(change.itemId)
					break
				case 'update': {
					const oldObj = this.store.get(change.itemId)
					if (!oldObj) throw new Error(`Got update for unknown surface item: ${change.itemId}`)
					applyJsonPatchInPlace(oldObj, change.patch)
					break
				}
				default:
					console.error(`Unknown surfaces change change: ${changeType}`)
					assertNever(change)
					break
			}
		}
	})

	public updateOutboundSurfaces = action((change: OutboundSurfacesUpdate | null) => {
		if (!change) {
			this.outboundSurfaces.clear()
			return
		}

		const changeType = change.type
		switch (change.type) {
			case 'init':
				this.outboundSurfaces.clear()
				for (const [id, item] of Object.entries(change.items)) {
					this.outboundSurfaces.set(id, item)
				}
				break
			case 'add': {
				const existing = this.outboundSurfaces.get(change.itemId)
				if (existing) {
					updateObjectInPlace(existing, change.info)
				} else {
					this.outboundSurfaces.set(change.itemId, change.info)
				}
				break
			}
			case 'remove':
				this.outboundSurfaces.delete(change.itemId)
				break
			default:
				console.error(`Unknown remote surfaces change change: ${changeType}`)
				assertNever(change)
				break
		}
	})

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

	public get allOutboundSurfaceCollectionIds(): string[] {
		const collectionIds: string[] = []

		const collectCollectionIDs = (collections: Iterable<OutboundSurfaceCollection>): void => {
			for (const collection of collections || []) {
				collectionIds.push(collection.id)
				collectCollectionIDs(collection.children)
			}
		}

		collectCollectionIDs(this.outboundSurfaceCollections.values())

		return collectionIds
	}

	public outboundSurfaceRootCollections(): OutboundSurfaceCollection[] {
		return Array.from(this.outboundSurfaceCollections.values()).sort((a, b) => a.sortOrder - b.sortOrder)
	}

	public resetOutboundSurfaceCollections = action((newData: OutboundSurfaceCollection[] | null) => {
		this.outboundSurfaceCollections.clear()

		if (newData) {
			for (const collection of newData) {
				if (!collection) continue

				const existing = this.outboundSurfaceCollections.get(collection.id)
				if (existing) {
					updateObjectInPlace(existing, collection)
				} else {
					this.outboundSurfaceCollections.set(collection.id, collection)
				}
			}
		}
	})
}
