import { observable, action } from 'mobx'
import type { InstanceStatusEntry } from '@companion-app/shared/Model/InstanceStatus.js'
import { assertNever } from '~/Resources/util.js'

export type InstanceStatusUpdate =
	| {
			type: 'init'
			statuses: Record<string, InstanceStatusEntry>
	  }
	| {
			type: 'remove'
			instanceId: string
	  }
	| {
			type: 'update'
			instanceId: string
			status: InstanceStatusEntry
	  }

export class InstanceStatusesStore {
	readonly statuses = observable.map<string, InstanceStatusEntry>()

	public getStatus(instanceId: string): InstanceStatusEntry | undefined {
		return this.statuses.get(instanceId)
	}

	public updateStatuses = action((update: InstanceStatusUpdate | null) => {
		if (!update) {
			this.statuses.clear()
			return
		}

		switch (update.type) {
			case 'init':
				this.statuses.replace(update.statuses)
				break
			case 'remove':
				this.statuses.delete(update.instanceId)
				break
			case 'update':
				this.statuses.set(update.instanceId, update.status)
				break
			default:
				assertNever(update)
				break
		}
	})
}
