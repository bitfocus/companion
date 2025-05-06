import type { UIHandler, ClientSocket } from '../UI/Handler.js'
import type { ConnectionGroup, ConnectionGroupsUpdate } from '@companion-app/shared/Model/Connections.js'
import type { ConnectionConfigStore } from './ConnectionConfigStore.js'
import type { DataDatabase } from '../Data/Database.js'
import type { DataStoreTableView } from '../Data/StoreBase.js'
import { nanoid } from 'nanoid'

const ConnectionGroupRoom = 'connection-groups'

export class InstanceUiGroups {
	readonly #io: UIHandler
	readonly #dbTable: DataStoreTableView<Record<string, ConnectionGroup>>

	readonly #configStore: ConnectionConfigStore

	#data: Record<string, ConnectionGroup>

	constructor(io: UIHandler, db: DataDatabase, configStore: ConnectionConfigStore) {
		this.#io = io
		this.#dbTable = db.getTableView('connection_groups')
		this.#configStore = configStore

		this.#data = this.#dbTable.all()
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
	}
}
