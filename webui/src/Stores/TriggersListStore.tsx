import { action, observable } from 'mobx'
import { assertNever } from '~/util.js'
import { applyPatch } from 'fast-json-patch'
import { cloneDeep } from 'lodash-es'
import type { ClientTriggerData, TriggersUpdate } from '@companion-app/shared/Model/TriggerModel.js'

export class TriggersListStore {
	readonly triggers = observable.map<string, ClientTriggerData>()

	public reset = action((newData: Record<string, ClientTriggerData | undefined> | null) => {
		this.triggers.clear()

		if (newData) {
			for (const [triggerId, triggerInfo] of Object.entries(newData)) {
				if (!triggerInfo) continue

				this.triggers.set(triggerId, triggerInfo)
			}
		}
	})

	public applyChange = action((change: TriggersUpdate) => {
		const changeType = change.type
		switch (change.type) {
			case 'add':
				this.triggers.set(change.controlId, change.info)
				break
			case 'remove':
				this.triggers.delete(change.controlId)
				break
			case 'update': {
				const oldObj = this.triggers.get(change.controlId)
				if (!oldObj) throw new Error(`Got update for unknown trigger: ${change.controlId}`)
				const newObj = applyPatch(cloneDeep(oldObj), change.patch)
				this.triggers.set(change.controlId, newObj.newDocument)
				break
			}
			default:
				console.error(`Unknown trigger change change: ${changeType}`)
				assertNever(change)
				break
		}
	})
}
