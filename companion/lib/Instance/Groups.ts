import type { UIHandler, ClientSocket } from '../UI/Handler.js'
import type { ConnectionGroup, ConnectionGroupsUpdate } from '@companion-app/shared/Model/Connections.js'
import type { ConnectionConfigStore } from './ConnectionConfigStore.js'
import type { DataDatabase } from '../Data/Database.js'
import type { DataStoreTableView } from '../Data/StoreBase.js'
import { nanoid } from 'nanoid'

const ConnectionGroupRoom = 'connection-groups'

export class InstanceGroups {
	readonly #io: UIHandler
	readonly #dbTable: DataStoreTableView<Record<string, ConnectionGroup>>

	readonly #configStore: ConnectionConfigStore

	#data: Record<string, ConnectionGroup>

	constructor(io: UIHandler, db: DataDatabase, configStore: ConnectionConfigStore) {
		this.#io = io
		this.#dbTable = db.getTableView('connection_groups')
		this.#configStore = configStore

		this.#data = this.#dbTable.all()

		// Initialize parentId field for any existing groups that don't have it
		for (const groupId in this.#data) {
			if (!('parentId' in this.#data[groupId])) {
				this.#data[groupId].parentId = null
				this.#dbTable.set(groupId, this.#data[groupId])
			}
		}
	}

	/**
	 * Discard all groups and put all connections back to the default group
	 */
	discardAllGroups(): void {
		this.#dbTable.clear()

		const changes: ConnectionGroupsUpdate[] = []
		for (const groupId of Object.keys(this.#data)) {
			changes.push({
				type: 'remove',
				id: groupId,
			})
		}
		this.#data = {}

		this.#io.emitToRoom(ConnectionGroupRoom, 'connection-groups:patch', changes)

		this.removeUnknownGroupReferences()
	}

	/**
	 * Ensure that all groupIds in connections are valid groups
	 */
	removeUnknownGroupReferences(): void {
		this.#configStore.cleanUnkownGroupIds(Object.keys(this.#data))
	}

	/**
	 * Check if setting parentId would create a circular reference
	 * @param groupId The group that would be moved
	 * @param newParentId The proposed new parent ID
	 * @returns true if a circular reference would be created, false otherwise
	 */
	wouldCreateCircularReference(groupId: string, newParentId: string | null): boolean {
		if (newParentId === null) return false // Null parent can't create a circular ref
		if (groupId === newParentId) return true // Direct self-reference

		// Check if any of newParentId's ancestors is the groupId
		let currentId: string | null = newParentId
		const visited = new Set<string>()

		while (currentId !== null) {
			if (visited.has(currentId)) {
				// Found an existing circular reference in the ancestry
				return true
			}

			visited.add(currentId)

			if (currentId === groupId) {
				// Found our original group in the ancestry - would create a cycle
				return true
			}

			const group = this.#data[currentId]
			if (!group) {
				// Invalid parent reference, can't continue checking
				return false
			}

			currentId = group.parentId
		}

		return false
	}

	/**
	 * Setup a new socket client's events
	 */
	clientConnect(client: ClientSocket): void {
		client.onPromise('connection-groups:subscribe', () => {
			client.join(ConnectionGroupRoom)

			return this.#data
		})

		client.onPromise('connection-groups:unsubscribe', () => {
			client.leave(ConnectionGroupRoom)
		})

		client.onPromise('connection-groups:add', (groupName: string) => {
			const newId = nanoid()
			const newGroup: ConnectionGroup = {
				id: newId,
				label: groupName,
				sortOrder: Math.max(0, ...Object.values(this.#data).map((group) => group.sortOrder)) + 1,
				parentId: null,
			}

			this.#data[newId] = newGroup
			this.#dbTable.set(newId, newGroup)

			this.#io.emitToRoom(ConnectionGroupRoom, 'connection-groups:patch', [
				{
					type: 'update',
					id: newId,
					info: newGroup,
				},
			])

			return newId
		})

		client.onPromise('connection-groups:remove', (groupId: string) => {
			// If no group, nothing to do
			if (!this.#data[groupId]) return

			delete this.#data[groupId]
			this.#dbTable.delete(groupId)

			this.#io.emitToRoom(ConnectionGroupRoom, 'connection-groups:patch', [
				{
					type: 'remove',
					id: groupId,
				},
			])

			// Update any groups that had this as parent
			const childGroups = Object.entries(this.#data).filter(([, group]) => group.parentId === groupId)
			for (const [childId, childGroup] of childGroups) {
				childGroup.parentId = null
				this.#dbTable.set(childId, childGroup)

				this.#io.emitToRoom(ConnectionGroupRoom, 'connection-groups:patch', [
					{
						type: 'update',
						id: childId,
						info: childGroup,
					},
				])
			}

			// Ensure any connections are moved back to the default group
			this.removeUnknownGroupReferences()
		})

		client.onPromise('connection-groups:set-name', (groupId: string, groupName: string) => {
			const group = this.#data[groupId]
			if (!group) throw new Error(`Group ${groupId} not found`)

			group.label = groupName
			this.#dbTable.set(groupId, group)

			this.#io.emitToRoom(ConnectionGroupRoom, 'connection-groups:patch', [
				{
					type: 'update',
					id: groupId,
					info: group,
				},
			])
		})

		client.onPromise('connection-groups:reorder', (groupId: string, parentId: string | null, dropIndex: number) => {
			// If no group, nothing to do
			const thisGroup = this.#data[groupId]
			if (!thisGroup) throw new Error(`Group ${groupId} not found`)

			const changes: ConnectionGroupsUpdate[] = []
			const originalParentId = thisGroup.parentId

			// Handle parent change if needed
			if (parentId !== originalParentId) {
				// Check if the parent exists (unless it's null)
				if (parentId !== null && !this.#data[parentId]) {
					throw new Error(`Parent group ${parentId} not found`)
				}

				// Check for circular references
				if (this.wouldCreateCircularReference(groupId, parentId)) {
					throw new Error('Cannot set parent: would create a circular reference')
				}

				// Update the parent
				thisGroup.parentId = parentId
				this.#dbTable.set(groupId, thisGroup)

				// Add to changes
				changes.push({
					type: 'update',
					id: groupId,
					info: thisGroup,
				})
			}

			// Get all groups with the same NEW parent (excluding this group) sorted by their current sortOrder
			const sortedGroups = Object.entries(this.#data)
				.filter(([id, group]) => id !== groupId && group.parentId === parentId)
				.sort(([, a], [, b]) => a.sortOrder - b.sortOrder)

			// Insert the group being moved at the drop index
			if (dropIndex < 0) {
				sortedGroups.push([groupId, thisGroup])
			} else {
				sortedGroups.splice(dropIndex, 0, [groupId, thisGroup])
			}

			// Update the sortOrder of all groups based on their new position
			sortedGroups.forEach(([id, group], index) => {
				if (group.sortOrder !== index) {
					group.sortOrder = index
					this.#dbTable.set(id, group)

					// Only add to changes if not already included
					if (id !== groupId || !changes.some((change) => change.id === id)) {
						changes.push({
							type: 'update',
							id,
							info: group,
						})
					} else {
						// Update the existing entry in changes
						const existingChange = changes.find((change) => change.id === id)
						if (existingChange && existingChange.type === 'update') {
							existingChange.info = group
						}
					}
				}
			})

			// Notify clients of the changes
			if (changes.length > 0) {
				this.#io.emitToRoom(ConnectionGroupRoom, 'connection-groups:patch', changes)
			}
		})
	}
}
