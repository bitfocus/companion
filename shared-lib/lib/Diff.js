import jsonPatch from 'fast-json-patch'

/**
 * Diff a structure of objects, generating a json-patch for each inner object individually
 * @template T
 * @param {Record<string, T | undefined>} oldObjects
 * @param {Record<string, T | undefined>} newObjects
 * @returns {import("./Model/Common.js").ObjectsDiff<T> | undefined}
 */
export function diffObjects(oldObjects, newObjects) {
	/** @type {import("./Model/Common.js").ObjectsDiff<T>} */
	const diff = {
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
