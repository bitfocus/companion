import type { UIHandler, ClientSocket } from '../UI/Handler.js'
import type { ConnectionGroup } from '@companion-app/shared/Model/Connections.js'
import type { ConnectionConfigStore } from './ConnectionConfigStore.js'
import type { DataDatabase } from '../Data/Database.js'
import { nanoid } from 'nanoid'

const ConnectionGroupTable = 'connection_groups'
const ConnectionGroupRoom = 'connection-groups'

export class InstanceUiGroups {
	readonly #io: UIHandler
	readonly #db: DataDatabase

	readonly #configStore: ConnectionConfigStore

	#data: Record<string, ConnectionGroup> = {}

	constructor(io: UIHandler, db: DataDatabase, configStore: ConnectionConfigStore) {
		this.#io = io
		this.#db = db
		this.#configStore = configStore

		// Ensure the table exists
		this.#db.store.prepare(`CREATE TABLE IF NOT EXISTS ${ConnectionGroupTable} (id STRING UNIQUE, value STRING);`).run()

		this.#data = this.#db.getTable(ConnectionGroupTable)
	}

	discardAllGroups(): void {
		this.#db.emptyTable(ConnectionGroupTable)
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
			this.#db.setTableKey(ConnectionGroupTable, newId, newGroup)

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
			this.#db.deleteTableKey(ConnectionGroupTable, groupId)

			this.#io.emitToRoom(ConnectionGroupRoom, 'connection-groups:patch', [
				{
					type: 'remove',
					id: groupId,
				},
			])

			// Ensure any connections are moved back to the default group
			this.#configStore.cleanUnkownGroupIds(Object.keys(this.#data))
		})

		client.onPromise('connection-groups:set-name', (groupId: string, groupName: string) => {
			const group = this.#data[groupId]
			if (!group) throw new Error(`Group ${groupId} not found`)

			group.label = groupName
			this.#db.setTableKey(ConnectionGroupTable, groupId, group)

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
