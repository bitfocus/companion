import type { UIHandler, ClientSocket } from '../UI/Handler.js'
import type { ConnectionGroup } from '@companion-app/shared/Model/Connections.js'
import type { ConnectionConfigStore } from './ConnectionConfigStore.js'
import type { DataDatabase } from '../Data/Database.js'
import { GroupsBaseController } from '../Resources/GroupsBase.js'

const ConnectionGroupRoom = 'connection-groups'

export class InstanceGroups extends GroupsBaseController<undefined> {
	readonly #io: UIHandler

	readonly #configStore: ConnectionConfigStore

	constructor(io: UIHandler, db: DataDatabase, configStore: ConnectionConfigStore) {
		super(db.getTableView<Record<string, ConnectionGroup>>('connection_groups'))

		this.#io = io
		this.#configStore = configStore
	}

	/**
	 * Ensure that all groupIds in connections are valid groups
	 */
	override removeUnknownGroupReferences(): void {
		this.#configStore.cleanUnknownGroupIds(this.collectAllGroupIds())
	}

	override emitUpdate(rows: ConnectionGroup[]): void {
		this.#io.emitToRoom(ConnectionGroupRoom, 'connection-groups:update', rows)
	}

	/**
	 * Setup a new socket client's events
	 */
	clientConnect(client: ClientSocket): void {
		client.onPromise('connection-groups:subscribe', () => {
			client.join(ConnectionGroupRoom)

			return this.data
		})

		client.onPromise('connection-groups:unsubscribe', () => {
			client.leave(ConnectionGroupRoom)
		})

		client.onPromise('connection-groups:add', (groupName: string) => {
			return this.groupAdd(
				groupName,
				undefined // No metadata for connection groups
			)
		})

		client.onPromise('connection-groups:remove', this.groupRemove)
		client.onPromise('connection-groups:set-name', this.groupSetName)
		client.onPromise('connection-groups:reorder', this.groupMove)
	}
}
