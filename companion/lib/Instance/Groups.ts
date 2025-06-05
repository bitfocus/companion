import type { UIHandler, ClientSocket } from '../UI/Handler.js'
import type { ConnectionGroup } from '@companion-app/shared/Model/Connections.js'
import type { ConnectionConfigStore } from './ConnectionConfigStore.js'
import type { DataDatabase } from '../Data/Database.js'
import type { DataStoreTableView } from '../Data/StoreBase.js'
import { nanoid } from 'nanoid'

const ConnectionGroupRoom = 'connection-groups'

export class InstanceGroups {
	readonly #io: UIHandler
	readonly #dbTable: DataStoreTableView<Record<string, ConnectionGroup>>

	readonly #configStore: ConnectionConfigStore

	#data: ConnectionGroup[]

	constructor(io: UIHandler, db: DataDatabase, configStore: ConnectionConfigStore) {
		this.#io = io
		this.#dbTable = db.getTableView('connection_groups')
		this.#configStore = configStore

		// Note: Storing in the database like this is not optimal, but it is much simpler
		this.#data = Object.values(this.#dbTable.all()).sort((a, b) => a.sortOrder - b.sortOrder)
		for (const data of this.#data) {
			data.children = data.children || []
			data.children.sort((a, b) => a.sortOrder - b.sortOrder)
		}
	}

	/**
	 * Discard all groups and put all connections back to the default group
	 */
	discardAllGroups(): void {
		this.#dbTable.clear()

		this.#data = []

		this.#io.emitToRoom(ConnectionGroupRoom, 'connection-groups:update', [])

		this.removeUnknownGroupReferences()
	}

	/**
	 * Ensure that all groupIds in connections are valid groups
	 */
	removeUnknownGroupReferences(): void {
		this.#configStore.cleanUnknownGroupIds(Object.keys(this.#data))
	}

	/**
	 * Check if a group contains another group
	 * @param group The group to search
	 * @param otherGroupId The group id to search for
	 * @returns
	 */
	#doesGroupContainOtherGroup(group: ConnectionGroup, otherGroupId: string): boolean {
		if (group.id === otherGroupId) return true // Direct match

		// Check if any of the children contain the other group
		for (const child of group.children) {
			if (this.#doesGroupContainOtherGroup(child, otherGroupId)) {
				return true
			}
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
			const lastGroup = this.#data[this.#data.length - 1] as ConnectionGroup | undefined

			const newId = nanoid()
			const newGroup: ConnectionGroup = {
				id: newId,
				label: groupName,
				sortOrder: lastGroup ? lastGroup.sortOrder + 1 : 0,
				children: [],
			}

			this.#data.push(newGroup)
			this.#dbTable.set(newId, newGroup)

			this.#io.emitToRoom(ConnectionGroupRoom, 'connection-groups:update', this.#data)

			return newId
		})

		client.onPromise('connection-groups:remove', (groupId: string) => {
			const matchedGroup = this.#findGroupAndParent(groupId)
			if (!matchedGroup) return

			if (!matchedGroup.parentGroup) {
				const group = matchedGroup.group

				const index = this.#data.findIndex((child) => child.id === group.id)
				if (index === -1) {
					throw new Error(`Group ${groupId} not found at root level`)
				}

				this.#data.splice(index, 1, ...group.children) // Remove the group, and rehome its children
				this.#data.forEach((child, i) => {
					child.sortOrder = i // Reset sortOrder for children
				})

				// Update the database
				this.#dbTable.delete(groupId)
				for (const child of group.children) {
					this.#dbTable.set(child.id, child)
				}
			} else {
				// The group exists, depeer in the hierarchy
				const { rootGroup, parentGroup, group } = matchedGroup

				const index = parentGroup.children.findIndex((child) => child.id === group.id)
				if (index === -1) {
					throw new Error(`Group ${groupId} not found in parent ${parentGroup.id}`)
				}

				parentGroup.children.splice(index, 1, ...group.children) // Remove the group, and rehome its children
				parentGroup.children.forEach((child, i) => {
					child.sortOrder = i // Reset sortOrder for children
				})

				this.#dbTable.set(rootGroup.id, rootGroup)
			}

			// Inform the ui of the shuffle
			this.#io.emitToRoom(ConnectionGroupRoom, 'connection-groups:update', this.#data)

			// Ensure any connections are moved back to the default group
			this.removeUnknownGroupReferences()
		})

		client.onPromise('connection-groups:set-name', (groupId: string, groupName: string) => {
			const matchedGroup = this.#findGroupAndParent(groupId)
			if (!matchedGroup) throw new Error(`Group ${groupId} not found`)

			matchedGroup.group.label = groupName
			this.#dbTable.set(matchedGroup.rootGroup.id, matchedGroup.rootGroup)

			// Inform the ui of the patch
			this.#io.emitToRoom(ConnectionGroupRoom, 'connection-groups:update', this.#data)
		})

		client.onPromise('connection-groups:reorder', (groupId: string, parentId: string | null, dropIndex: number) => {
			if (groupId === parentId) {
				// Cannot move a group into itself
				return
			}

			const matchedGroup = this.#findGroupAndParent(groupId)
			if (!matchedGroup) throw new Error(`Group ${groupId} not found`)

			const newParentGroup = parentId ? this.#findGroupAndParent(parentId) : null
			if (parentId && !newParentGroup) {
				throw new Error(`Parent group ${parentId} not found`)
			}

			if (parentId && this.#doesGroupContainOtherGroup(matchedGroup.group, parentId)) {
				// Can't move group into its own child
				return
			}

			const currentParentArray = matchedGroup.parentGroup ? matchedGroup.parentGroup.children : this.#data

			const currentIndex = currentParentArray.findIndex((child) => child.id === groupId)
			if (currentIndex === -1)
				throw new Error(`Group ${groupId} not found in parent ${matchedGroup.parentGroup?.id || 'root'}`)

			// Remove from the old position
			currentParentArray.splice(currentIndex, 1)
			currentParentArray.forEach((child, i) => {
				child.sortOrder = i // Reset sortOrder for children
			})

			const newParentArray = newParentGroup ? newParentGroup.group.children : this.#data
			newParentArray.splice(dropIndex, 0, matchedGroup.group) // Insert at the new position
			newParentArray.forEach((child, i) => {
				child.sortOrder = i // Reset sortOrder for children
			})

			// Update the database
			// Note: this is being lazy, by writing every row, it could be optimized
			for (const row of this.#data) {
				this.#dbTable.set(row.id, row)
			}

			// Inform the ui of the shuffle
			this.#io.emitToRoom(ConnectionGroupRoom, 'connection-groups:update', this.#data)

			// Future: perform side effects like updating enabled statuses
		})
	}

	#findGroupAndParent(groupId: string): {
		// The root level group, that contains the group (could be the same as parentGroup or group)
		rootGroup: ConnectionGroup
		// The direct parent group of the group we are looking for, or null if group is at the root
		parentGroup: ConnectionGroup | null
		// The group we are looking for
		group: ConnectionGroup
	} | null {
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
				return { rootGroup: group, parentGroup: null, group: found[1] }
			}

			// Found the group and its parent
			return { rootGroup: group, parentGroup: found[0], group: found[1] }
		}

		return null
	}
}
