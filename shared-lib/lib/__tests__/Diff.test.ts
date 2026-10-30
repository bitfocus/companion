import { describe, expect, it } from 'vitest'
import { applyObjectPatch, diffObject, diffObjects, type ObjectPatch } from '../Diff.js'

interface SampleObject {
	name: string
	value?: number
	nested?: { a: number; b?: number }
}

describe('diffObjects', () => {
	it('returns undefined when both inputs are empty', () => {
		expect(diffObjects({}, {})).toBeUndefined()
	})

	it('returns undefined when nothing has changed', () => {
		const objects: Record<string, SampleObject> = {
			a: { name: 'a', value: 1 },
			b: { name: 'b', value: 2 },
		}
		// Use distinct object instances with equal contents
		const oldObjects = structuredClone(objects)
		const newObjects = structuredClone(objects)
		expect(diffObjects(oldObjects, newObjects)).toBeUndefined()
	})

	it('detects added objects', () => {
		const oldObjects: Record<string, SampleObject> = {
			a: { name: 'a' },
		}
		const newObjects: Record<string, SampleObject> = {
			a: { name: 'a' },
			b: { name: 'b', value: 5 },
		}

		const diff = diffObjects(oldObjects, newObjects)
		expect(diff).toEqual({
			added: { b: { name: 'b', value: 5 } },
			changed: {},
			removed: [],
		})
	})

	it('detects removed objects', () => {
		const oldObjects: Record<string, SampleObject> = {
			a: { name: 'a' },
			b: { name: 'b' },
		}
		const newObjects: Record<string, SampleObject> = {
			a: { name: 'a' },
		}

		const diff = diffObjects(oldObjects, newObjects)
		expect(diff).toEqual({
			added: {},
			changed: {},
			removed: ['b'],
		})
	})

	it('detects changed objects via an object patch', () => {
		const oldObjects: Record<string, SampleObject> = {
			a: { name: 'a', value: 1 },
		}
		const newObjects: Record<string, SampleObject> = {
			a: { name: 'a', value: 2 },
		}

		const diff = diffObjects(oldObjects, newObjects)
		expect(diff).toEqual({
			added: {},
			changed: {
				a: [{ op: 'set', path: ['value'], value: 2 }],
			},
			removed: [],
		})
	})

	it('detects changes in nested properties', () => {
		const oldObjects: Record<string, SampleObject> = {
			a: { name: 'a', nested: { a: 1, b: 2 } },
		}
		const newObjects: Record<string, SampleObject> = {
			a: { name: 'a', nested: { a: 1, b: 3 } },
		}

		const diff = diffObjects(oldObjects, newObjects)
		expect(diff).toEqual({
			added: {},
			changed: {
				a: [{ op: 'set', path: ['nested', 'b'], value: 3 }],
			},
			removed: [],
		})
	})

	it('handles a mix of added, changed and removed objects', () => {
		const oldObjects: Record<string, SampleObject> = {
			keep: { name: 'keep' },
			change: { name: 'change', value: 1 },
			remove: { name: 'remove' },
		}
		const newObjects: Record<string, SampleObject> = {
			keep: { name: 'keep' },
			change: { name: 'change', value: 2 },
			add: { name: 'add' },
		}

		const diff = diffObjects(oldObjects, newObjects)
		expect(diff).toEqual({
			added: { add: { name: 'add' } },
			changed: {
				change: [{ op: 'set', path: ['value'], value: 2 }],
			},
			removed: ['remove'],
		})
	})

	it('ignores undefined values in newObjects', () => {
		const oldObjects: Record<string, SampleObject | undefined> = {
			a: { name: 'a' },
		}
		const newObjects: Record<string, SampleObject | undefined> = {
			a: { name: 'a' },
			b: undefined,
		}

		// `b` is undefined so it should not be treated as added
		expect(diffObjects(oldObjects, newObjects)).toBeUndefined()
	})

	it('treats an object becoming undefined as removed', () => {
		const oldObjects: Record<string, SampleObject | undefined> = {
			a: { name: 'a' },
			b: { name: 'b' },
		}
		const newObjects: Record<string, SampleObject | undefined> = {
			a: { name: 'a' },
			b: undefined,
		}

		const diff = diffObjects(oldObjects, newObjects)
		expect(diff).toEqual({
			added: {},
			changed: {},
			removed: ['b'],
		})
	})

	it('treats an id that was undefined before and is now set as added', () => {
		const oldObjects: Record<string, SampleObject | undefined> = {
			a: undefined,
		}
		const newObjects: Record<string, SampleObject | undefined> = {
			a: { name: 'a' },
		}

		const diff = diffObjects(oldObjects, newObjects)
		expect(diff).toEqual({
			added: { a: { name: 'a' } },
			changed: {},
			removed: [],
		})
	})

	it('flags an id that is undefined in both as removed (current behaviour)', () => {
		// The removal loop only checks the new value, not whether the old value
		// was actually defined, so an id that is undefined in both is still
		// reported as removed.
		const oldObjects: Record<string, SampleObject | undefined> = {
			a: undefined,
		}
		const newObjects: Record<string, SampleObject | undefined> = {
			a: undefined,
		}

		const diff = diffObjects(oldObjects, newObjects)
		expect(diff).toEqual({
			added: {},
			changed: {},
			removed: ['a'],
		})
	})
})

describe('diffObject', () => {
	it('returns an empty patch for equal values', () => {
		expect(diffObject({ a: 1, b: { c: [1, 2] } }, { a: 1, b: { c: [1, 2] } })).toEqual([])
	})

	it('sets changed and added properties', () => {
		expect(diffObject<Record<string, unknown>>({ a: 1 }, { a: 2, b: { c: 3 } })).toEqual([
			{ op: 'set', path: ['a'], value: 2 },
			{ op: 'set', path: ['b'], value: { c: 3 } },
		])
	})

	it('removes missing and undefined properties', () => {
		expect(diffObject<Record<string, unknown>>({ a: 1, b: 2, c: undefined }, { b: undefined })).toEqual([
			{ op: 'remove', path: ['a'] },
			{ op: 'remove', path: ['b'] },
		])
	})

	it('sets a property that was previously undefined', () => {
		expect(diffObject<Record<string, unknown>>({ a: undefined }, { a: 1 })).toEqual([
			{ op: 'set', path: ['a'], value: 1 },
		])
	})

	it('replaces a value whose type changed', () => {
		expect(
			diffObject<Record<string, unknown>>({ a: [1], b: { c: 1 }, d: null }, { a: { 0: 1 }, b: 'x', d: {} })
		).toEqual([
			{ op: 'set', path: ['a'], value: { 0: 1 } },
			{ op: 'set', path: ['b'], value: 'x' },
			{ op: 'set', path: ['d'], value: {} },
		])
	})

	it('diffs arrays index by index', () => {
		expect(diffObject({ list: [1, { a: 1 }, 3] }, { list: [1, { a: 2 }, 3] })).toEqual([
			{ op: 'set', path: ['list', 1, 'a'], value: 2 },
		])
	})

	it('removes trailing array items from the end first', () => {
		expect(diffObject({ list: [1, 2, 3, 4] }, { list: [1] })).toEqual([
			{ op: 'remove', path: ['list', 3] },
			{ op: 'remove', path: ['list', 2] },
			{ op: 'remove', path: ['list', 1] },
		])
	})

	it('appends new array items, with undefined items becoming null', () => {
		expect(diffObject<{ list: unknown[] }>({ list: [1] }, { list: [1, 2, undefined] })).toEqual([
			{ op: 'set', path: ['list', 1], value: 2 },
			{ op: 'set', path: ['list', 2], value: null },
		])
	})

	it('keeps keys containing path-like characters as-is', () => {
		expect(diffObject<Record<string, number>>({ 'a/b': 1 }, { 'a/b': 2, '~0': 3 })).toEqual([
			{ op: 'set', path: ['a/b'], value: 2 },
			{ op: 'set', path: ['~0'], value: 3 },
		])
	})

	it('clones values, so later mutation of the source does not change the patch', () => {
		const newValue = { a: { b: 1 } }
		const patch = diffObject<Record<string, unknown>>({}, newValue)
		newValue.a.b = 2
		expect(patch).toEqual([{ op: 'set', path: ['a'], value: { b: 1 } }])
	})

	it('uses toJSON of new values', () => {
		const date = new Date('2026-01-01T00:00:00.000Z')
		expect(diffObject<Record<string, unknown>>({ when: '2025' }, { when: date })).toEqual([
			{ op: 'set', path: ['when'], value: '2026-01-01T00:00:00.000Z' },
		])
	})

	it('replaces the root when switching between array and object', () => {
		expect(diffObject<unknown>({ a: 1 }, [1])).toEqual([{ op: 'set', path: [], value: [1] }])
	})
})

describe('applyObjectPatch', () => {
	it('mutates the target in place', () => {
		const target: Record<string, any> = { a: 1, b: { c: 2 }, list: [1, 2, 3] }
		const nested = target.b
		const result = applyObjectPatch(target, [
			{ op: 'set', path: ['a'], value: 5 },
			{ op: 'set', path: ['b', 'd'], value: 3 },
			{ op: 'remove', path: ['b', 'c'] },
			{ op: 'remove', path: ['list', 2] },
			{ op: 'set', path: ['list', 0], value: 9 },
		])

		expect(result).toBe(target)
		expect(target.b).toBe(nested)
		expect(target).toEqual({ a: 5, b: { d: 3 }, list: [9, 2] })
	})

	it('appends to an array when setting at its length', () => {
		const target = { list: [1] }
		applyObjectPatch(target, [{ op: 'set', path: ['list', 1], value: 2 }])
		expect(target.list).toEqual([1, 2])
	})

	it('returns the new value when the root is replaced', () => {
		const patch: ObjectPatch<unknown> = [{ op: 'set', path: [], value: [1] }]
		expect(applyObjectPatch<unknown>({ a: 1 }, patch)).toEqual([1])
	})

	it('throws when removing the root', () => {
		expect(() => applyObjectPatch({ a: 1 }, [{ op: 'remove', path: [] }])).toThrow()
	})

	it('throws when the parent does not exist', () => {
		expect(() => applyObjectPatch<Record<string, any>>({ a: 1 }, [{ op: 'set', path: ['b', 'c'], value: 1 }])).toThrow()
		expect(() => applyObjectPatch<Record<string, any>>({ a: 1 }, [{ op: 'set', path: ['a', 'c'], value: 1 }])).toThrow()
	})

	it('throws when setting past the end of an array', () => {
		expect(() => applyObjectPatch({ list: [1] }, [{ op: 'set', path: ['list', 3], value: 1 }])).toThrow()
	})

	it('refuses to touch prototypes', () => {
		const target: Record<string, any> = {}
		expect(() => applyObjectPatch(target, [{ op: 'set', path: ['__proto__'], value: { polluted: true } }])).toThrow()
		expect(() =>
			applyObjectPatch(target, [{ op: 'set', path: ['constructor', 'prototype', 'polluted'], value: true }])
		).toThrow()
		expect(({} as Record<string, any>).polluted).toBeUndefined()
	})

	it('round-trips diffObject output', () => {
		const cases: [unknown, unknown][] = [
			[{}, { a: 1 }],
			[
				{ a: 1, b: 2 },
				{ b: 3, c: 4 },
			],
			[{ list: [1, 2, 3] }, { list: [3] }],
			[{ list: [] }, { list: [{ a: 1 }, [2, 3]] }],
			[{ a: { b: { c: [1, { d: 2 }] } } }, { a: { b: { c: [1, { d: 3, e: 4 }, 5] } } }],
			[{ a: [1, 2] }, { a: { 0: 1 } }],
			[{ a: null }, { a: { b: 1 } }],
			[
				[1, 2, 3],
				[3, 2],
			],
			[{ a: 1 }, [1]],
		]
		for (const [oldValue, newValue] of cases) {
			const patch = diffObject(oldValue, newValue)
			// Patches go over the wire as JSON
			const wirePatch = JSON.parse(JSON.stringify(patch)) as ObjectPatch<unknown>
			expect(applyObjectPatch(structuredClone(oldValue), wirePatch)).toEqual(newValue)
		}
	})
})
