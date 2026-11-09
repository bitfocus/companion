import { prepare as fuzzyPrepare } from 'fuzzysort'
import { describe, expect, it } from 'vitest'
import { fuzzyFilterSort, fuzzySearchByKeys } from '../fuzzy.js'

function prepared(labels: string[]) {
	return labels.map((label) => ({ label, fuzzy: fuzzyPrepare(label) }))
}

function labels(items: Array<{ label: string }>) {
	return items.map((item) => item.label)
}

describe('fuzzyFilterSort', () => {
	const items = prepared(['Set Preview Input', 'Cut', 'Set Program Input', 'Auto Transition', 'Program'])

	it('drops items that do not match', () => {
		expect(fuzzyFilterSort(items, 'zzz')).toEqual([])
	})

	it('sorts best match first', () => {
		expect(labels(fuzzyFilterSort(items, 'program'))).toEqual(['Program', 'Set Program Input'])
	})

	it('matches words in any order', () => {
		expect(labels(fuzzyFilterSort(items, 'input program'))).toEqual(['Set Program Input'])
	})

	it('is case insensitive', () => {
		expect(labels(fuzzyFilterSort(items, 'CUT'))).toEqual(['Cut'])
	})

	it('drops weak matches with the default min score', () => {
		// 'pin' is scattered across 'Set Preview Input' / 'Set Program Input'
		expect(labels(fuzzyFilterSort(items, 'stpin'))).toEqual([])
		expect(labels(fuzzyFilterSort(items, 'stpin', 0)).sort()).toEqual(['Set Preview Input', 'Set Program Input'])
	})

	it('respects a custom min score', () => {
		expect(labels(fuzzyFilterSort(items, 'program', 1))).toEqual(['Program'])
	})

	it('ignores diacritics', () => {
		expect(labels(fuzzyFilterSort(prepared(['Café', 'Tea']), 'cafe'))).toEqual(['Café'])
		expect(labels(fuzzyFilterSort(prepared(['Cafe', 'Tea']), 'café'))).toEqual(['Cafe'])
	})

	it('returns all items in the original order when scores tie', () => {
		const same = prepared(['abc', 'abc', 'abc'])
		expect(fuzzyFilterSort(same, 'abc')).toEqual(same)
	})

	it('handles an empty list', () => {
		expect(fuzzyFilterSort([], 'abc')).toEqual([])
	})
})

describe('fuzzySearchByKeys', () => {
	interface Item {
		title: string
		subtitle: string
	}
	const items: Item[] = [
		{ title: 'Buttons', subtitle: 'Page 1' },
		{ title: 'Connections', subtitle: 'Add or edit connections' },
		{ title: 'Triggers', subtitle: 'Run actions on events' },
		{ title: 'Settings', subtitle: 'Configure buttons' },
	]

	it('searches every key', () => {
		expect(fuzzySearchByKeys(items, 'buttons', ['title', 'subtitle'], 0.5, 0).map((i) => i.title)).toEqual([
			'Buttons',
			'Settings',
		])
	})

	it('only searches the given keys', () => {
		expect(fuzzySearchByKeys(items, 'buttons', ['title'], 0.5, 0).map((i) => i.title)).toEqual(['Buttons'])
	})

	it('accepts a key getter', () => {
		expect(
			fuzzySearchByKeys(items, 'events', [(item) => `${item.title} ${item.subtitle}`], 0.5, 0).map((i) => i.title)
		).toEqual(['Triggers'])
	})

	it('matches words across keys', () => {
		expect(fuzzySearchByKeys(items, 'triggers events', ['title', 'subtitle'], 0.5, 0).map((i) => i.title)).toEqual([
			'Triggers',
		])
	})

	it('drops matches below the threshold', () => {
		expect(fuzzySearchByKeys(items, 'tgr', ['title'], 0, 0).map((i) => i.title)).toEqual(['Triggers'])
		expect(fuzzySearchByKeys(items, 'tgr', ['title'], 0.5, 0)).toEqual([])
	})

	it('returns nothing for no match', () => {
		expect(fuzzySearchByKeys(items, 'zzz', ['title', 'subtitle'], 0, 0)).toEqual([])
	})

	it('returns every match when unlimited', () => {
		const many = Array.from({ length: 50 }, (_, i) => ({ title: `Item ${i}`, subtitle: '' }))
		expect(fuzzySearchByKeys(many, 'item', ['title'], 0.5, 0)).toHaveLength(50)
	})

	it('applies the limit', () => {
		const many = Array.from({ length: 50 }, (_, i) => ({ title: `Item ${i}`, subtitle: '' }))
		expect(fuzzySearchByKeys(many, 'item', ['title'], 0.5, 40)).toHaveLength(40)
		expect(fuzzySearchByKeys(many, 'item', ['title'], 0.5, 3)).toHaveLength(3)
	})
})
