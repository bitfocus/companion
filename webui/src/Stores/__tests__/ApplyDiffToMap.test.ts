import { observable, reaction } from 'mobx'
import { describe, expect, it } from 'vitest'
import { diffObject, diffObjects } from '@companion-app/shared/Diff.js'
import { ApplyDiffToStore, updateObjectInPlace } from '../ApplyDiffToMap.js'

interface Item {
	name: string
	tags: string[]
	extra?: number
}

describe('ApplyDiffToStore', () => {
	it('applies added, changed and removed objects to an observable map', () => {
		const oldItems: Record<string, Item> = {
			keep: { name: 'keep', tags: ['a'] },
			change: { name: 'change', tags: ['a', 'b'], extra: 1 },
			remove: { name: 'remove', tags: [] },
		}
		const newItems: Record<string, Item> = {
			keep: { name: 'keep', tags: ['a'] },
			change: { name: 'changed', tags: ['a', 'c', 'd'] },
			add: { name: 'add', tags: [] },
		}

		const map = observable.map<string, Item>(structuredClone(oldItems))
		const changedObj = map.get('change')

		const diff = diffObjects(oldItems, newItems)
		if (!diff) throw new Error('Expected a diff')
		ApplyDiffToStore(map, diff)

		expect(Object.fromEntries(map.toJSON())).toEqual(newItems)
		// Changes are applied to the existing observable, not by replacing it
		expect(map.get('change')).toBe(changedObj)
	})

	it('only notifies observers of the properties that changed', () => {
		const oldItem: Item = { name: 'a', tags: ['x'] }
		const map = observable.map<string, Item>({ a: structuredClone(oldItem) })

		const nameChanges: string[] = []
		const tagChanges: string[][] = []
		reaction(
			() => map.get('a')?.name,
			(name) => name && nameChanges.push(name)
		)
		reaction(
			() => map.get('a')?.tags.slice(),
			(tags) => tags && tagChanges.push(tags)
		)

		ApplyDiffToStore(map, {
			added: {},
			changed: { a: diffObject(oldItem, { name: 'a', tags: ['x', 'y'] }) },
			removed: [],
		})

		expect(nameChanges).toEqual([])
		expect(tagChanges).toEqual([['x', 'y']])
	})
})

describe('updateObjectInPlace', () => {
	it('replaces the shallow contents of the target', () => {
		const target: Partial<Item> = { name: 'a', extra: 1 }
		updateObjectInPlace(target, { name: 'b', tags: [] })
		expect(target).toEqual({ name: 'b', tags: [] })
	})
})
