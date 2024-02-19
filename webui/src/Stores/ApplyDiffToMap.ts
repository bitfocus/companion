import { ObjectsDiff } from '@companion-app/shared/Model/Common.js'
import { ObservableMap } from 'mobx'
import { applyPatch } from 'fast-json-patch'
import { cloneDeep } from 'lodash-es'

export function ApplyDiffToStore<T>(map: ObservableMap<string, T>, diff: ObjectsDiff<T>): void {
	for (const id of diff.removed) {
		map.delete(id)
	}

	// TODO - this should report if one of the updates failed

	for (const [id, patch] of Object.entries(diff.changed)) {
		const oldObj = map.get(id)
		if (!oldObj) continue

		const newObj = applyPatch(cloneDeep(oldObj), patch)
		map.set(id, newObj.newDocument)
	}

	for (const [id, obj] of Object.entries(diff.added)) {
		map.set(id, obj)
	}
}
