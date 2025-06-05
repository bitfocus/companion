import type { UIHandler, ClientSocket } from '../UI/Handler.js'
import type { ConnectionGroup } from '@companion-app/shared/Model/Connections.js'
import type { DataDatabase } from '../Data/Database.js'
import { GroupsBaseController } from '../Resources/GroupsBase.js'
import type { TriggerGroup } from '@companion-app/shared/Model/TriggerModel.js'

const TriggerGroupRoom = 'trigger-groups'

export class TriggerGroups extends GroupsBaseController<undefined> {
	readonly #io: UIHandler

	readonly #cleanUnknownGroupIds: (groupIds: Set<string>) => void

	constructor(io: UIHandler, db: DataDatabase, cleanUnknownGroupIds: (groupIds: Set<string>) => void) {
		super(db.getTableView<Record<string, TriggerGroup>>('trigger_groups'))

		this.#io = io
		this.#cleanUnknownGroupIds = cleanUnknownGroupIds
	}

	/**
	 * Ensure that all groupIds in triggers are valid groups
	 */
	override removeUnknownGroupReferences(): void {
		this.#cleanUnknownGroupIds(this.collectAllGroupIds())
	}

	override emitUpdate(rows: ConnectionGroup[]): void {
		this.#io.emitToRoom(TriggerGroupRoom, 'trigger-groups:update', rows)
	}

	/**
	 * Setup a new socket client's events
	 */
	clientConnect(client: ClientSocket): void {
		client.onPromise('trigger-groups:subscribe', () => {
			client.join(TriggerGroupRoom)

			return this.data
		})

		client.onPromise('trigger-groups:unsubscribe', () => {
			client.leave(TriggerGroupRoom)
		})

		client.onPromise('trigger-groups:add', (groupName: string) => {
			return this.groupAdd(
				groupName,
				undefined // No metadata for trigger groups
			)
		})

		client.onPromise('trigger-groups:remove', this.groupRemove)
		client.onPromise('trigger-groups:set-name', this.groupSetName)
		client.onPromise('trigger-groups:reorder', this.groupMove)
	}
}
