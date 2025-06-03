import { observable, action } from 'mobx'
import { assertNever } from '~/util.js'
import type { ClientConnectionsUpdate, ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'

export class ConnectionsStore {
	readonly connections = observable.map<string, ClientConnectionConfig>()

	public get count() {
		return this.connections.size
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

	public reset = action((newData: Record<string, ClientConnectionConfig | undefined> | null) => {
		this.connections.clear()

		if (newData) {
			for (const [connectionId, connectionConfig] of Object.entries(newData)) {
				if (!connectionConfig) continue

				this.connections.set(connectionId, connectionConfig)
			}
		}
	})

	public applyChange = action((changes: ClientConnectionsUpdate[]) => {
		for (const change of changes) {
			const changeType = change.type
			switch (change.type) {
				// case 'add':
				// 	this.connections.set(change.id, change.info)
				// 	break
				case 'remove':
					this.connections.delete(change.id)
					break
				case 'update': {
					// const oldObj = this.connections.get(change.id)
					// if (!oldObj) throw new Error(`Got update for unknown module: ${change.id}`)

					this.connections.set(change.id, change.info)
					break
				}
				default:
					console.error(`Unknown action definitions change: ${changeType}`)
					assertNever(change)
					break
			}
		}
	})
}
