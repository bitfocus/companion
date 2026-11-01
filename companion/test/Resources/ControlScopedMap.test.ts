import { describe, expect, test } from 'vitest'
import { ControlScopedMap } from '../../lib/Resources/ControlScopedMap.js'

interface Item {
	controlId: string
	name: string
}

function idsForControl(map: ControlScopedMap<Item>, controlId: string): string[] {
	return Array.from(map.getForControl(controlId)?.keys() ?? [])
}

describe('ControlScopedMap', () => {
	test('indexes items by their controlId', () => {
		const map = new ControlScopedMap<Item>()
		map.set('a', { controlId: 'c1', name: 'a' })
		map.set('b', { controlId: 'c1', name: 'b' })
		map.set('c', { controlId: 'c2', name: 'c' })

		expect(map.size).toBe(3)
		expect(map.get('b')?.name).toBe('b')
		expect(idsForControl(map, 'c1')).toEqual(['a', 'b'])
		expect(idsForControl(map, 'c2')).toEqual(['c'])
		expect(map.getForControl('c3')).toBeUndefined()
		expect(Array.from(map).map(([id]) => id)).toEqual(['a', 'b', 'c'])
	})

	test('moves an item between controls when replaced with a different controlId', () => {
		const map = new ControlScopedMap<Item>()
		map.set('a', { controlId: 'c1', name: 'a' })
		map.set('a', { controlId: 'c2', name: 'a2' })

		expect(map.size).toBe(1)
		expect(map.getForControl('c1')).toBeUndefined()
		expect(idsForControl(map, 'c2')).toEqual(['a'])
		expect(map.getForControl('c2')?.get('a')?.name).toBe('a2')
	})

	test('replacing an item on the same control updates the index', () => {
		const map = new ControlScopedMap<Item>()
		map.set('a', { controlId: 'c1', name: 'a' })
		map.set('a', { controlId: 'c1', name: 'a2' })

		expect(map.getForControl('c1')?.get('a')?.name).toBe('a2')
	})

	test('delete removes the item and drops empty control buckets', () => {
		const map = new ControlScopedMap<Item>()
		map.set('a', { controlId: 'c1', name: 'a' })
		map.set('b', { controlId: 'c1', name: 'b' })

		expect(map.delete('a')).toBe(true)
		expect(map.delete('a')).toBe(false)
		expect(idsForControl(map, 'c1')).toEqual(['b'])

		map.delete('b')
		expect(map.size).toBe(0)
		expect(map.getForControl('c1')).toBeUndefined()
	})

	test('clear empties the map and the index', () => {
		const map = new ControlScopedMap<Item>()
		map.set('a', { controlId: 'c1', name: 'a' })
		map.clear()

		expect(map.size).toBe(0)
		expect(map.getForControl('c1')).toBeUndefined()
	})

	test('supports deleting the current entry while iterating', () => {
		const map = new ControlScopedMap<Item>()
		map.set('a', { controlId: 'c1', name: 'a' })
		map.set('b', { controlId: 'c2', name: 'b' })
		map.set('c', { controlId: 'c1', name: 'c' })

		const seen: string[] = []
		for (const [id] of map) {
			seen.push(id)
			if (id !== 'b') map.delete(id)
		}

		expect(seen).toEqual(['a', 'b', 'c'])
		expect(Array.from(map.values()).map((v) => v.name)).toEqual(['b'])
		expect(map.getForControl('c1')).toBeUndefined()
	})
})
