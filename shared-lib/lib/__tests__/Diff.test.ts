import { describe, expect, it } from 'vitest'
import { diffObjects } from '../Diff.js'

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

	it('detects changed objects via json-patch', () => {
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
				a: [{ op: 'replace', path: '/value', value: 2 }],
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
				a: [{ op: 'replace', path: '/nested/b', value: 3 }],
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
				change: [{ op: 'replace', path: '/value', value: 2 }],
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
