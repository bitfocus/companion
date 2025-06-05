import type { DataStoreTableView } from '../Data/StoreBase.js'
import { nanoid } from 'nanoid'
import type { GroupBase } from '@companion-app/shared/Model/Groups.js'

export abstract class GroupsBaseController<TGroupMetadata> {
	readonly #dbTable: DataStoreTableView<Record<string, GroupBase<TGroupMetadata>>>

	protected data: GroupBase<TGroupMetadata>[]

	constructor(dbTable: DataStoreTableView<Record<string, GroupBase<TGroupMetadata>>>) {
		this.#dbTable = dbTable

		// Note: Storing in the database like this is not optimal, but it is much simpler
		this.data = Object.values(this.#dbTable.all()).sort((a, b) => a.sortOrder - b.sortOrder)
		for (const data of this.data) {
			data.children = data.children || []
			data.children.sort((a, b) => a.sortOrder - b.sortOrder)
		}
	}

	/**
	 * Discard all groups and put all items back to the default group
	 */
	discardAllGroups(): void {
		this.#dbTable.clear()

		this.data = []

		this.emitUpdate([])

		this.removeUnknownGroupReferences()
	}

	protected abstract emitUpdate(rows: GroupBase<TGroupMetadata>[]): void

	/**
	 * Ensure that all groupIds in the data are valid groups
	 */
	abstract removeUnknownGroupReferences(): void

	protected collectAllGroupIds(): Set<string> {
		const groupIds = new Set<string>()

		const collectGroupIds = (groups: GroupBase<TGroupMetadata>[]) => {
			for (const group of groups) {
				groupIds.add(group.id)
				collectGroupIds(group.children)
			}
		}

		collectGroupIds(this.data)

		return groupIds
	}

	/**
	 * Check if a group contains another group
	 * @param group The group to search
	 * @param otherGroupId The group id to search for
	 * @returns
	 */
	#doesGroupContainOtherGroup(group: GroupBase<TGroupMetadata>, otherGroupId: string): boolean {
		if (group.id === otherGroupId) return true // Direct match

		// Check if any of the children contain the other group
		for (const child of group.children) {
			if (this.#doesGroupContainOtherGroup(child, otherGroupId)) {
				return true
			}
		}

		return false
	}

	protected get groupData(): GroupBase<TGroupMetadata>[] {
		return this.data
	}

	protected groupAdd = (label: string, metaData: TGroupMetadata) => {
		const lastGroup = this.data[this.data.length - 1] as GroupBase<TGroupMetadata> | undefined

		const newId = nanoid()
		const newGroupFull: GroupBase<TGroupMetadata> = {
			id: nanoid(),
			label,
			sortOrder: lastGroup ? lastGroup.sortOrder + 1 : 0,
			children: [],
			metaData,
		}

		this.data.push(newGroupFull)
		this.#dbTable.set(newId, newGroupFull)

		this.emitUpdate(this.data)

		return newId
	}

	protected groupRemove = (groupId: string) => {
		const matchedGroup = this.#findGroupAndParent(groupId)
		if (!matchedGroup) return

		if (!matchedGroup.parentGroup) {
			const group = matchedGroup.group

			const index = this.data.findIndex((child) => child.id === group.id)
			if (index === -1) {
				throw new Error(`Group ${groupId} not found at root level`)
			}

			this.data.splice(index, 1, ...group.children) // Remove the group, and rehome its children
			this.data.forEach((child, i) => {
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
		this.emitUpdate(this.data)

		// Ensure any items are moved back to the default group
		this.removeUnknownGroupReferences()
	}

	protected groupSetName = (groupId: string, groupName: string) => {
		const matchedGroup = this.#findGroupAndParent(groupId)
		if (!matchedGroup) throw new Error(`Group ${groupId} not found`)

		matchedGroup.group.label = groupName
		this.#dbTable.set(matchedGroup.rootGroup.id, matchedGroup.rootGroup)

		// Inform the ui of the patch
		this.emitUpdate(this.data)
	}

	protected groupMove = (groupId: string, parentId: string | null, dropIndex: number) => {
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

		const currentParentArray = matchedGroup.parentGroup ? matchedGroup.parentGroup.children : this.data

		const currentIndex = currentParentArray.findIndex((child) => child.id === groupId)
		if (currentIndex === -1)
			throw new Error(`Group ${groupId} not found in parent ${matchedGroup.parentGroup?.id || 'root'}`)

		// Remove from the old position
		currentParentArray.splice(currentIndex, 1)
		currentParentArray.forEach((child, i) => {
			child.sortOrder = i // Reset sortOrder for children
		})

		const newParentArray = newParentGroup ? newParentGroup.group.children : this.data
		newParentArray.splice(dropIndex, 0, matchedGroup.group) // Insert at the new position
		newParentArray.forEach((child, i) => {
			child.sortOrder = i // Reset sortOrder for children
		})

		// Update the database
		// Note: this is being lazy, by writing every row, it could be optimized
		for (const row of this.data) {
			this.#dbTable.set(row.id, row)
		}

		// Inform the ui of the shuffle
		this.emitUpdate(this.data)

		// Future: perform side effects like updating enabled statuses
	}

	#findGroupAndParent(groupId: string): {
		// The root level group, that contains the group (could be the same as parentGroup or group)
		rootGroup: GroupBase<TGroupMetadata>
		// The direct parent group of the group we are looking for, or null if group is at the root
		parentGroup: GroupBase<TGroupMetadata> | null
		// The group we are looking for
		group: GroupBase<TGroupMetadata>
	} | null {
		const findGroup = (
			parentGroup: GroupBase<TGroupMetadata>,
			candidate: GroupBase<TGroupMetadata>
		): [parent: GroupBase<TGroupMetadata>, group: GroupBase<TGroupMetadata>] | null => {
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

		for (const group of this.data.values()) {
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
