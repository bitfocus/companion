import { describe, expect, test } from 'vitest'
import z from 'zod'
import { findSchemaIncompatibilities } from './SchemaCompatibility.js'

function compare(oldSchema: z.ZodType, newSchema: z.ZodType): string[] {
	return findSchemaIncompatibilities(
		z.toJSONSchema(oldSchema, { io: 'input' }),
		z.toJSONSchema(newSchema, { io: 'input' })
	)
}

describe('findSchemaIncompatibilities', () => {
	const base = z.object({ name: z.string(), count: z.number().optional() })

	describe('compatible changes', () => {
		test.each<[string, z.ZodType]>([
			['no change', base],
			['an optional property added', base.extend({ extra: z.boolean().optional() })],
			['a property with a default added', base.extend({ extra: z.boolean().default(false) })],
			['a required property made optional', base.extend({ name: z.string().optional() })],
			['a type widened', base.extend({ name: z.union([z.string(), z.number()]) })],
			['a default changed', base.extend({ count: z.number().default(5) })],
			['a property allowed anything', base.extend({ name: z.any() })],
		])('%s', (_name, newSchema) => {
			expect(compare(base, newSchema)).toEqual([])
		})

		test('an enum gaining a value', () => {
			expect(compare(z.enum(['a', 'b']), z.enum(['a', 'b', 'c']))).toEqual([])
		})

		test('a discriminated union gaining an option', () => {
			const a = z.object({ type: z.literal('a'), value: z.string() })
			const b = z.object({ type: z.literal('b'), count: z.number() })

			expect(compare(z.discriminatedUnion('type', [a]), z.discriminatedUnion('type', [a, b]))).toEqual([])
		})

		test('a record gaining an optional property in its values', () => {
			expect(
				compare(z.record(z.string(), base), z.record(z.string(), base.extend({ x: z.string().optional() })))
			).toEqual([])
		})
	})

	describe('incompatible changes', () => {
		test.each<[string, z.ZodType, string]>([
			['a required property added', base.extend({ extra: z.boolean() }), '.extra: was added as required'],
			['an optional property made required', base.extend({ count: z.number() }), '.count: is now required'],
			['a property removed', base.omit({ count: true }), '.count: was removed'],
			['a property retyped', base.extend({ name: z.number() }), '.name: no longer accepts string'],
			['a property restricted to a value', base.extend({ name: z.literal('x') }), '.name: is now restricted to "x"'],
			['a property given a constraint', base.extend({ name: z.string().min(2) }), '.name: "minLength" changed'],
			['other properties refused', base.strict(), 'no longer accepts other properties'],
		])('%s', (_name, newSchema, expected) => {
			const issues = compare(base, newSchema)
			expect(issues).toHaveLength(1)
			expect(issues[0]).toContain(expected)
		})

		test('an enum losing a value', () => {
			expect(compare(z.enum(['a', 'b']), z.enum(['a']))).toEqual(['(root): no longer accepts "b"'])
		})

		test('a literal changed', () => {
			expect(compare(z.literal(17), z.literal(18))).toEqual(['(root): no longer accepts 17'])
		})

		test('anything restricted', () => {
			expect(compare(z.any(), z.string())).toEqual(['(root): accepted anything, but is now restricted'])
		})

		test('a discriminated union losing an option, or one of its options changing', () => {
			const a = z.object({ type: z.literal('a'), value: z.string() })
			const b = z.object({ type: z.literal('b'), count: z.number() })
			const before = z.discriminatedUnion('type', [a, b])

			expect(compare(before, z.discriminatedUnion('type', [a]))).not.toEqual([])
			expect(compare(before, z.discriminatedUnion('type', [a, b.extend({ count: z.string() })]))).toEqual([
				'<option 1>.count: no longer accepts number',
			])
		})

		test('the items of an array, or the values of a record, retyped', () => {
			expect(compare(z.array(z.string()), z.array(z.number()))).toEqual(['[]: no longer accepts string'])
			expect(compare(z.record(z.string(), z.string()), z.record(z.string(), z.number()))).toEqual([
				'.*: no longer accepts string',
			])
		})
	})

	describe('recursive schemas', () => {
		interface Node {
			name: string
			children?: Node[]
		}
		const node: z.ZodType<Node> = z.object({
			name: z.string(),
			get children() {
				return z.array(node).optional()
			},
		})

		interface ChangedNode {
			name: number
			children?: ChangedNode[]
		}
		const changedNode: z.ZodType<ChangedNode> = z.object({
			name: z.number(),
			get children() {
				return z.array(changedNode).optional()
			},
		})

		test('are compared without looping', () => {
			expect(compare(node, node)).toEqual([])
		})

		test('report a change within them', () => {
			expect(compare(node, changedNode)).toContain('.name: no longer accepts string')
		})
	})
})
