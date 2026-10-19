import { describe, expect, test } from 'vitest'
import { elementSchemas } from '../../Graphics/ElementPropertiesSchemas.js'
import { SomeCompanionInputFieldSchema, type SomeCompanionInputField } from '../Options.js'

describe('SomeCompanionInputFieldSchema', () => {
	test('accepts every element property definition', () => {
		for (const [elementType, sections] of Object.entries(elementSchemas)) {
			for (const section of sections) {
				for (const field of section.fields) {
					const res = SomeCompanionInputFieldSchema.safeParse(field)
					expect(res.error, `${elementType}.${section.id}.${field.id}`).toBeUndefined()
				}
			}
		}
	})

	test('accepts nested fields of a table', () => {
		const field: SomeCompanionInputField = {
			type: 'internal:table',
			id: 'tbl',
			label: 'Table',
			default: [],
			columns: [
				{ type: 'textinput', id: 'name', label: 'Name' },
				{
					type: 'internal:list',
					id: 'list',
					label: 'List',
					default: [],
					fields: [{ type: 'checkbox', id: 'on', label: 'On', default: false }],
				},
			],
		}
		expect(SomeCompanionInputFieldSchema.parse(field)).toEqual(field)
	})

	test('rejects an invalid nested field', () => {
		const res = SomeCompanionInputFieldSchema.safeParse({
			type: 'internal:table',
			id: 'tbl',
			label: 'Table',
			default: [],
			columns: [{ type: 'checkbox', id: 'on', label: 'On' }],
		})
		expect(res.success).toBe(false)
	})

	test('requires a default only for fields which need one', () => {
		expect(SomeCompanionInputFieldSchema.safeParse({ type: 'textinput', id: 'a', label: 'A' }).success).toBe(true)
		expect(SomeCompanionInputFieldSchema.safeParse({ type: 'checkbox', id: 'a', label: 'A' }).success).toBe(false)
		expect(
			SomeCompanionInputFieldSchema.safeParse({ type: 'checkbox', id: 'a', label: 'A', default: true }).success
		).toBe(true)
	})

	test('rejects a default for fields without a value', () => {
		expect(
			SomeCompanionInputFieldSchema.safeParse({ type: 'static-text', id: 'a', label: 'A', value: 'hi', default: 1 })
				.success
		).toBe(false)
	})

	test('reports the error from the schema of the matching type', () => {
		const res = SomeCompanionInputFieldSchema.safeParse({ type: 'checkbox', id: 'a', label: 'A' })
		expect(res.error?.issues.map((issue) => issue.path)).toEqual([['default']])
	})

	test('rejects an unknown type', () => {
		expect(SomeCompanionInputFieldSchema.safeParse({ type: 'not-a-type', id: 'a', label: 'A' }).success).toBe(false)
	})

	test('validates defaultForControlType', () => {
		const base = { type: 'number', id: 'a', label: 'A', default: 1, min: 0, max: 10 }
		expect(SomeCompanionInputFieldSchema.safeParse({ ...base, defaultForControlType: { trigger: 2 } }).success).toBe(
			true
		)
		expect(SomeCompanionInputFieldSchema.safeParse({ ...base, defaultForControlType: { trigger: 'x' } }).success).toBe(
			false
		)
		expect(
			SomeCompanionInputFieldSchema.safeParse({ ...base, defaultForControlType: { 'not-a-kind': 2 } }).success
		).toBe(false)
	})
})
