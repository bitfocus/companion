import { renderHook } from '@testing-library/react'
import { prepare as fuzzyPrepare } from 'fuzzysort'
import { describe, expect, it } from 'vitest'
import type { DropdownChoicesOrGroups } from '../../DropdownChoices.js'
import {
	filterFuzzyItems,
	isGroupedFuzzyItems,
	prependFuzzyChoices,
	useFuzzyChoices,
	type FuzzyChoice,
	type FuzzyItems,
} from '../useFuzzyChoices.js'

function choice(id: string, label: string): FuzzyChoice {
	return { id, label, fuzzy: fuzzyPrepare(label) }
}

/** Reduce items to their ids, keeping the group structure */
function shape(items: FuzzyItems): unknown[] {
	return isGroupedFuzzyItems(items)
		? items.map((group) => ({ group: group.label, ids: group.items.map((item) => item.id) }))
		: items.map((item) => item.id)
}

function prepare(choices: DropdownChoicesOrGroups) {
	return renderHook(() => useFuzzyChoices(choices, true)).result.current
}

describe('useFuzzyChoices', () => {
	it('keeps flat choices flat', () => {
		const { allItems, flatItems } = prepare([
			{ id: 'a', label: 'A' },
			{ id: 'b', label: 'B' },
		])
		expect(shape(allItems)).toEqual(['a', 'b'])
		expect(flatItems.map((item) => item.id)).toEqual(['a', 'b'])
	})

	it('keeps record choices flat', () => {
		const { allItems } = prepare({ x: { id: 'a', label: 'A' }, y: { id: 'b', label: 'B' } })
		expect(shape(allItems)).toEqual(['a', 'b'])
	})

	it('keeps grouped choices grouped', () => {
		const { allItems } = prepare([
			{ label: 'One', options: [{ id: 'a', label: 'A' }] },
			{ label: 'Two', options: [{ id: 'b', label: 'B' }] },
		])
		expect(shape(allItems)).toEqual([
			{ group: 'One', ids: ['a'] },
			{ group: 'Two', ids: ['b'] },
		])
	})

	it('wraps each run of ungrouped choices in an unlabelled group when mixed with groups', () => {
		const { allItems, flatItems } = prepare([
			{ id: 'a', label: 'A' },
			{ id: 'b', label: 'B' },
			{ label: 'One', options: [{ id: 'c', label: 'C' }] },
			{ id: 'd', label: 'D' },
		])
		expect(shape(allItems)).toEqual([
			{ group: '', ids: ['a', 'b'] },
			{ group: 'One', ids: ['c'] },
			{ group: '', ids: ['d'] },
		])
		expect(flatItems.map((item) => item.id)).toEqual(['a', 'b', 'c', 'd'])

		// The group ids are used as react keys, so must be unique
		const groupIds = allItems.map((group) => group.id)
		expect(new Set(groupIds).size).toBe(groupIds.length)
	})
})

describe('prependFuzzyChoices', () => {
	it('prepends to flat items', () => {
		expect(shape(prependFuzzyChoices([choice('a', 'A')], [choice('x', 'X')]))).toEqual(['x', 'a'])
	})

	it('prepends an unlabelled group to grouped items', () => {
		const items: FuzzyItems = [{ id: 'one', label: 'One', items: [choice('a', 'A')] }]
		expect(shape(prependFuzzyChoices(items, [choice('x', 'X')]))).toEqual([
			{ group: '', ids: ['x'] },
			{ group: 'One', ids: ['a'] },
		])
	})

	it('returns the items unchanged when there is nothing to prepend', () => {
		const items: FuzzyItems = [choice('a', 'A')]
		expect(prependFuzzyChoices(items, [])).toBe(items)
	})
})

describe('filterFuzzyItems', () => {
	it('filters and sorts flat items', () => {
		const items: FuzzyItems = [choice('a', 'Apple'), choice('b', 'Banana'), choice('c', 'Pineapple')]
		expect(shape(filterFuzzyItems(items, 'apple'))).toEqual(['a', 'c'])
	})

	it('filters within groups and drops emptied groups', () => {
		const items: FuzzyItems = [
			{ id: 'fruit', label: 'Fruit', items: [choice('a', 'Apple'), choice('b', 'Banana')] },
			{ id: 'veg', label: 'Veg', items: [choice('c', 'Carrot')] },
		]
		expect(shape(filterFuzzyItems(items, 'apple'))).toEqual([{ group: 'Fruit', ids: ['a'] }])
	})
})
