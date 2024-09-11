import jsonPatch from 'fast-json-patch'
import type { ObjectsDiff } from './Model/Common.js'

/**
 * Diff a structure of objects, generating a json-patch for each inner object individually
 */
export function diffObjects<T>(
	oldObjects: Record<string, T | undefined>,
	newObjects: Record<string, T | undefined>
): ObjectsDiff<T> | undefined {
	const diff: ObjectsDiff<T> = {
		added: {},
		changed: {},
		removed: [],
	}
	let isEmpty = true

	for (const [id, newObject] of Object.entries(newObjects)) {
		const oldObject = oldObjects[id]
		if (!newObject) {
			continue
		} else if (!oldObject) {
			diff.added[id] = newObject
			isEmpty = false
		} else {
			diff.changed[id] = jsonPatch.compare(oldObject, newObject)
			isEmpty = false
		}
	}

	for (const id of Object.keys(oldObjects)) {
		if (!newObjects[id]) {
			diff.removed.push(id)
			isEmpty = false
		}
	}

	if (isEmpty) return undefined
	return diff
}
