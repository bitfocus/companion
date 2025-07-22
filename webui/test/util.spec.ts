import { describe, expect, test } from 'vitest'
import { deepFreeze } from '../src/Resources/util'

describe('deepFreeze', () => {
	describe('values should appear unchanged', () => {
		test('string', () => {
			const obj = deepFreeze('test')
			expect(obj).toBe('test')
		})

		test('number', () => {
			const obj = deepFreeze(123)
			expect(obj).toBe(123)
		})

		test('object', () => {
			const obj = deepFreeze({ a: 123 })
			expect(obj).toEqual({ a: 123 })
		})

		test('array', () => {
			const obj = deepFreeze([1, 2, 3])
			expect(obj).toEqual([1, 2, 3])
		})

		test('array of objects', () => {
			const obj = deepFreeze([{ id: 1 }, { id: 2 }, { id: 3 }])
			expect(obj).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])

			expect(obj.find((o) => o.id === 2)).toEqual({ id: 2 })
		})
	})
})
