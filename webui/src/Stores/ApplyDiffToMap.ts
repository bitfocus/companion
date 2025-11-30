import type { ObjectsDiff } from '@companion-app/shared/Model/Common.js'
import type { ObservableMap } from 'mobx'
import { applyPatch, type Operation as JsonPatchOperation } from 'fast-json-patch'

export function ApplyDiffToStore<T extends object>(map: ObservableMap<string, T>, diff: ObjectsDiff<T>): void {
	for (const id of diff.removed) {
		map.delete(id)
	}

	// TODO - this should report if one of the updates failed

	for (const [id, patch] of Object.entries(diff.changed)) {
		const oldObj = map.get(id)
		if (!oldObj) continue

		applyPatch(oldObj, patch, false, true)
	}

	for (const [id, obj] of Object.entries(diff.added)) {
		map.set(id, obj)
	}
}

export function updateObjectInPlace<T extends object>(target: T, source: Partial<T>): void {
	// Note: this will only operate correctly on shallow objects, and will not in place update deep objects

	// Remove keys not present in source
	for (const key of Object.keys(target)) {
		if (!(key in source)) {
			delete (target as any)[key]
		}
	}
	// Assign new/updated keys
	Object.assign(target, source)
}

export function applyJsonPatchInPlace<T extends object>(target: T, patch: JsonPatchOperation<T>[]): void {
	applyPatch(target, patch, false, true)
}
