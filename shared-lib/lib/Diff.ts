import type { ObjectsDiff } from './Model/Common.js'
import { assertNever } from './Util.js'

export type ObjectPatchPath = (string | number)[]

export type ObjectPatchOperation =
	{ op: 'set'; path: ObjectPatchPath; value: any } | { op: 'remove'; path: ObjectPatchPath }

/**
 * The changes to turn one version of an object into another, as produced by `diffObject`.
 * This is our own transport format, not RFC 6902 JSON Patch.
 */
export type ObjectPatch<T> = ObjectPatchOperation[] & { readonly __target?: T }

/**
 * Diff two versions of an object. Arrays are compared index by index, so only grow or shrink at the end.
 */
export function diffObject<T>(oldValue: T, newValue: T): ObjectPatch<T> {
	const patch: ObjectPatchOperation[] = []
	diffValue(patch, [], oldValue, newValue)
	return patch
}

function diffValue(patch: ObjectPatchOperation[], path: ObjectPatchPath, oldValue: unknown, newValue: unknown): void {
	if (oldValue === newValue) return

	if (isObjectLike(newValue) && typeof newValue.toJSON === 'function') newValue = newValue.toJSON()

	if (isObjectLike(oldValue) && isObjectLike(newValue) && Array.isArray(oldValue) === Array.isArray(newValue)) {
		if (Array.isArray(oldValue)) {
			diffArray(patch, path, oldValue, newValue as unknown[])
		} else {
			diffRecord(patch, path, oldValue, newValue)
		}
	} else if (oldValue !== newValue) {
		patch.push({ op: 'set', path, value: cloneValue(newValue) })
	}
}

function diffArray(patch: ObjectPatchOperation[], path: ObjectPatchPath, oldArr: unknown[], newArr: unknown[]): void {
	const commonLength = Math.min(oldArr.length, newArr.length)
	for (let i = 0; i < commonLength; i++) {
		diffValue(patch, [...path, i], oldArr[i], newArr[i])
	}

	// Remove from the end first, so the indices stay valid while applying
	for (let i = oldArr.length - 1; i >= newArr.length; i--) {
		patch.push({ op: 'remove', path: [...path, i] })
	}
	for (let i = oldArr.length; i < newArr.length; i++) {
		patch.push({ op: 'set', path: [...path, i], value: cloneValue(newArr[i]) })
	}
}

function diffRecord(
	patch: ObjectPatchOperation[],
	path: ObjectPatchPath,
	oldObj: Record<string, unknown>,
	newObj: Record<string, unknown>
): void {
	for (const [key, oldChild] of Object.entries(oldObj)) {
		const newChild = newObj[key]
		if (newChild === undefined) {
			if (oldChild !== undefined) patch.push({ op: 'remove', path: [...path, key] })
		} else {
			diffValue(patch, [...path, key], oldChild, newChild)
		}
	}

	for (const [key, newChild] of Object.entries(newObj)) {
		if (newChild !== undefined && !Object.hasOwn(oldObj, key)) {
			patch.push({ op: 'set', path: [...path, key], value: cloneValue(newChild) })
		}
	}
}

function isObjectLike(value: unknown): value is Record<string, any> {
	return typeof value === 'object' && value !== null
}

function cloneValue(value: unknown): unknown {
	if (value === undefined) return null // matches how JSON serialises array items
	if (typeof value === 'object') return JSON.parse(JSON.stringify(value))
	return value
}

/**
 * Apply a patch from `diffObject`, mutating `target` in place (so observable stores update granularly).
 * Returns the patched document, which is only a different value when the patch replaces the root.
 */
export function applyObjectPatch<T>(target: T, patch: ObjectPatch<T>): T {
	let document: unknown = target

	for (const operation of patch) {
		if (operation.path.length === 0) {
			if (operation.op !== 'set') throw new Error('Cannot remove the root of an object patch')
			document = operation.value
			continue
		}

		for (const key of operation.path) {
			if (key === '__proto__') throw new Error('Object patch path must not contain __proto__')
		}

		let parent: unknown = document
		for (const key of operation.path.slice(0, -1)) {
			if (!isObjectLike(parent) || !Object.hasOwn(parent, key)) {
				throw new Error(`Object patch path not found: ${operation.path.join('.')}`)
			}
			parent = parent[key]
		}
		if (!isObjectLike(parent)) throw new Error(`Object patch path not found: ${operation.path.join('.')}`)

		const key = operation.path[operation.path.length - 1]
		const opType = operation.op
		switch (operation.op) {
			case 'set':
				if (Array.isArray(parent)) {
					if (typeof key !== 'number' || key > parent.length) {
						throw new Error(`Object patch index out of range: ${operation.path.join('.')}`)
					}
					parent[key] = operation.value
				} else {
					parent[key] = operation.value
				}
				break
			case 'remove':
				if (Array.isArray(parent)) {
					if (typeof key !== 'number') throw new Error(`Object patch index invalid: ${operation.path.join('.')}`)
					parent.splice(key, 1)
				} else {
					delete parent[key]
				}
				break
			default:
				assertNever(operation)
				throw new Error(`Unknown object patch operation: ${opType}`)
		}
	}

	return document as T
}

/**
 * Diff a structure of objects, generating a patch for each inner object individually
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
			const patch = diffObject(oldObject, newObject)
			if (patch.length > 0) {
				diff.changed[id] = patch
				isEmpty = false
			}
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
