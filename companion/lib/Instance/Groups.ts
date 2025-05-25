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

	#data: Map<string, ConnectionGroup>

	constructor(io: UIHandler, db: DataDatabase, configStore: ConnectionConfigStore) {
		this.#io = io
		this.#dbTable = db.getTableView('connection_groups')
		this.#configStore = configStore

		// Note: Storing in the database like this is not optimal, but it is much simpler
		this.#data = new Map(Object.entries(this.#dbTable.all()))
	}

	/**
	 * Discard all groups and put all connections back to the default group
	 */
	discardAllGroups(): void {
		this.#dbTable.clear()

		const changes: ConnectionGroupsUpdate[] = []
		for (const groupId of this.#data.keys()) {
			changes.push({
				type: 'remove',
				id: groupId,
			})
		}
		this.#data.clear()

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

			const group = this.#data.get(currentId)
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

			return Object.fromEntries(this.#data.entries())
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
				// parentId: null,
				children: [],
			}

			this.#data.set(newId, newGroup)
			this.#dbTable.set(newId, newGroup)

			this.#io.emitToRoom(ConnectionGroupRoom, 'connection-groups:patch', [
				{
					type: 'update',
					id: newId,
					info: {
						...newGroup,
						children: [], // Group can't have children at creation time
					},
				},
			])

			return newId
		})

		client.onPromise('connection-groups:remove', (groupId: string) => {
			const matchedGroup = this.#findGroupAndParent(groupId)
			if (!matchedGroup) return

			if (!matchedGroup[1]) {
				// This was a root level group, so we can remove it directly
				this.#data.delete(groupId)
				this.#dbTable.delete(groupId)

				// Move all the children to the root level
				const group = matchedGroup[2]
				for (const child of group.children) {
					this.#data.set(child.id, child)
					this.#dbTable.set(child.id, child)
				}

				// TODO - update sortOrder of the root groups

				// Inform the ui of the shuffle
				this.#io.emitToRoom(ConnectionGroupRoom, 'connection-groups:patch', [
					{
						type: 'remove',
						id: groupId,
					},
					...group.children.map(
						(child) =>
							({
								type: 'update',
								id: child.id,
								info: child,
							}) satisfies ConnectionGroupsUpdate
					),
				])
			} else {
				// The group exists, depeer in the hierarchy
				const [rootGroup, parentGroup, group] = matchedGroup

				const index = parentGroup.children.findIndex((child) => child.id === group.id)
				if (index === -1) {
					throw new Error(`Group ${groupId} not found in parent ${parentGroup.id}`)
				}

				parentGroup.children.splice(index, 1, ...group.children) // Remove the group, and rehome its children

				group.children.forEach((child, i) => {
					child.sortOrder = i // Reset sortOrder for children
				})

				this.#dbTable.set(rootGroup.id, rootGroup)

				this.#io.emitToRoom(ConnectionGroupRoom, 'connection-groups:patch', [
					{
						type: 'update',
						id: rootGroup.id,
						info: rootGroup,
					},
				])
			}

			// Ensure any connections are moved back to the default group
			this.removeUnknownGroupReferences()
		})

		client.onPromise('connection-groups:set-name', (groupId: string, groupName: string) => {
			const matchedGroup = this.#findGroupAndParent(groupId)
			if (!matchedGroup) throw new Error(`Group ${groupId} not found`)

			matchedGroup[2].label = groupName
			this.#dbTable.set(matchedGroup[0].id, matchedGroup[0])

			this.#io.emitToRoom(ConnectionGroupRoom, 'connection-groups:patch', [
				{
					type: 'update',
					id: matchedGroup[0].id,
					info: matchedGroup[0],
				},
			])
		})

		client.onPromise('connection-groups:reorder', (groupId: string, parentId: string | null, dropIndex: number) => {
			// // If no group, nothing to do
			// const thisGroup = this.#data[groupId]
			// if (!thisGroup) throw new Error(`Group ${groupId} not found`)
			// const changes: ConnectionGroupsUpdate[] = []
			// const originalParentId = thisGroup.parentId
			// // Handle parent change if needed
			// if (parentId !== originalParentId) {
			// 	// Check if the parent exists (unless it's null)
			// 	if (parentId !== null && !this.#data[parentId]) {
			// 		throw new Error(`Parent group ${parentId} not found`)
			// 	}
			// 	// Check for circular references
			// 	if (this.wouldCreateCircularReference(groupId, parentId)) {
			// 		throw new Error('Cannot set parent: would create a circular reference')
			// 	}
			// 	// Update the parent
			// 	thisGroup.parentId = parentId
			// 	this.#dbTable.set(groupId, thisGroup)
			// 	// Add to changes
			// 	changes.push({
			// 		type: 'update',
			// 		id: groupId,
			// 		info: thisGroup,
			// 	})
			// }
			// // Get all groups with the same NEW parent (excluding this group) sorted by their current sortOrder
			// const sortedGroups = Object.entries(this.#data)
			// 	.filter(([id, group]) => id !== groupId && group.parentId === parentId)
			// 	.sort(([, a], [, b]) => a.sortOrder - b.sortOrder)
			// // Insert the group being moved at the drop index
			// if (dropIndex < 0) {
			// 	sortedGroups.push([groupId, thisGroup])
			// } else {
			// 	sortedGroups.splice(dropIndex, 0, [groupId, thisGroup])
			// }
			// // Update the sortOrder of all groups based on their new position
			// sortedGroups.forEach(([id, group], index) => {
			// 	if (group.sortOrder !== index) {
			// 		group.sortOrder = index
			// 		this.#dbTable.set(id, group)
			// 		// Only add to changes if not already included
			// 		if (id !== groupId || !changes.some((change) => change.id === id)) {
			// 			changes.push({
			// 				type: 'update',
			// 				id,
			// 				info: group,
			// 			})
			// 		} else {
			// 			// Update the existing entry in changes
			// 			const existingChange = changes.find((change) => change.id === id)
			// 			if (existingChange && existingChange.type === 'update') {
			// 				existingChange.info = group
			// 			}
			// 		}
			// 	}
			// })
			// // Notify clients of the changes
			// if (changes.length > 0) {
			// 	this.#io.emitToRoom(ConnectionGroupRoom, 'connection-groups:patch', changes)
			// }
		})
	}

	#findGroupAndParent(
		groupId: string
	): [rootGroup: ConnectionGroup, parent: ConnectionGroup | null, group: ConnectionGroup] | null {
		const findGroup = (
			parentGroup: ConnectionGroup,
			candidate: ConnectionGroup
		): [parent: ConnectionGroup, group: ConnectionGroup] | null => {
			// Check if this candidate is the group we are looking for
			if (candidate.id === groupId) {
				return [parentGroup, candidate]
			}

			// Search through the children of this candidate
			for (const child of candidate.children) {
				const found = findGroup(candidate, child)
				if (found) return found
			}

			return null
		}

		for (const group of this.#data.values()) {
			const found = findGroup(group, group)
			if (!found) continue // Not the group we are looking for

			if (found[0].id === found[1].id) {
				// This is the root group
				// Return null for root group parent
				return [group, null, found[1]]
			}

			// Found the group and its parent
			return [group, found[0], found[1]]
		}

		return null
	}
}
