import { observable, action } from 'mobx'
import { assertNever } from '../util.js'
import type {
	ClientConnectionsUpdate,
	ClientConnectionConfig,
	ConnectionGroup,
	ConnectionGroupsUpdate,
} from '@companion-app/shared/Model/Connections.js'

export class ConnectionsStore {
	readonly connections = observable.map<string, ClientConnectionConfig>()
	readonly groups = observable.map<string, ConnectionGroup>()

	public get count() {
		return this.connections.size
	}

	public get allGroupIds(): string[] {
		const groupIds: string[] = []

		const collectGroupIds = (groups: Iterable<ConnectionGroup>): void => {
			for (const group of groups || []) {
				groupIds.push(group.id)
				collectGroupIds(group.children)
			}
		}

		collectGroupIds(this.groups.values())

		return groupIds
	}

	public rootGroups(): ConnectionGroup[] {
		return Array.from(this.groups.values()).sort((a, b) => a.sortOrder - b.sortOrder)
	}

	public getInfo(connectionId: string): ClientConnectionConfig | undefined {
		return this.connections.get(connectionId)
	}

	public getLabel(connectionId: string): string | undefined {
		return this.connections.get(connectionId)?.label
	}

	public getAllOfType(moduleType: string): [id: string, info: ClientConnectionConfig][] {
		return Array.from(this.connections.entries()).filter(([_id, info]) => info && info.instance_type === moduleType)
	}

	public resetConnections = action((newData: Record<string, ClientConnectionConfig | undefined> | null) => {
		this.connections.clear()

		if (newData) {
			for (const [connectionId, connectionConfig] of Object.entries(newData)) {
				if (!connectionConfig) continue

				this.connections.set(connectionId, connectionConfig)
			}
		}
	})

	public applyConnectionsChange = action((changes: ClientConnectionsUpdate[]) => {
		for (const change of changes) {
			const changeType = change.type
			switch (change.type) {
				case 'remove':
					this.connections.delete(change.id)
					break
				case 'update': {
					this.connections.set(change.id, change.info)
					break
				}
				default:
					console.error(`Unknown connection change: ${changeType}`)
					assertNever(change)
					break
			}
		}
	})

	public resetGroups = action((newData: Record<string, ConnectionGroup | undefined> | null) => {
		this.groups.clear()

		if (newData) {
			for (const [groupId, group] of Object.entries(newData)) {
				if (!group) continue

				this.groups.set(groupId, group)
			}
		}
	})

	public applyGroupsChange = action((changes: ConnectionGroupsUpdate[]) => {
		for (const change of changes) {
			const changeType = change.type
			switch (change.type) {
				case 'remove':
					this.groups.delete(change.id)
					break
				case 'update': {
					this.groups.set(change.id, change.info)
					break
				}
				default:
					console.error(`Unknown connection groups change: ${changeType}`)
					assertNever(change)
					break
			}
		}
	})
}
