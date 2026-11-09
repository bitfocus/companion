import { describe, expect, test } from 'vitest'
import { elementSchemas, getDefaultPinnedProperties } from '@companion-app/shared/Graphics/ElementPropertiesSchemas.js'
import {
	ButtonGraphicsCompositeElementSchema,
	ButtonGraphicsGroupElementSchema,
	ButtonGraphicsTextElementSchema,
	SomeButtonGraphicsElementSchema,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import { ButtonGraphicsElementUsage } from '@companion-app/shared/Model/StyleModel.js'

// The element schemas are generated from the element property definitions, by tools/generate_graphics_types.mts

function fieldDefault(type: keyof typeof elementSchemas, fieldId: string): unknown {
	const field = elementSchemas[type].flatMap((section) => section.fields).find((field) => field.id === fieldId)
	return field && 'default' in field ? field.default : undefined
}

describe('SomeButtonGraphicsElementSchema', () => {
	test.each(Object.keys(elementSchemas))('a minimal %s element is given every default', (type) => {
		const element = SomeButtonGraphicsElementSchema.parse({ type, id: 'e1', connectionId: 'c', elementId: 'x' })

		const fields = elementSchemas[type as keyof typeof elementSchemas].flatMap((section) => section.fields)
		for (const field of fields) {
			expect(element, field.id).toHaveProperty(field.id, {
				isExpression: false,
				value: 'default' in field ? field.default : undefined,
			})
		}
		expect(element).toMatchObject({ type, id: 'e1', usage: ButtonGraphicsElementUsage.Automatic })
	})

	test('an invalid property falls back to its default, keeping the rest', () => {
		const text = ButtonGraphicsTextElementSchema.parse({
			type: 'text',
			id: 't1',
			text: { isExpression: false, value: 'Hello' },
			color: { isExpression: false, value: { not: 'a colour' } },
			halign: { isExpression: false, value: 'sideways' },
			fontsize: 'big',
		})

		expect(text.text).toEqual({ isExpression: false, value: 'Hello' })
		expect(text.color).toEqual({ isExpression: false, value: fieldDefault('text', 'color') })
		expect(text.halign).toEqual({ isExpression: false, value: fieldDefault('text', 'halign') })
		expect(text.fontsize).toEqual({ isExpression: false, value: fieldDefault('text', 'fontsize') })
	})

	test('keeps expressions', () => {
		const text = ButtonGraphicsTextElementSchema.parse({
			type: 'text',
			id: 't1',
			text: { isExpression: true, value: '$(internal:time_hms)' },
		})

		expect(text.text).toEqual({ isExpression: true, value: '$(internal:time_hms)' })
	})

	test('an invalid name, usage or set of pinned properties falls back to the default', () => {
		const text = ButtonGraphicsTextElementSchema.parse({
			type: 'text',
			id: 't1',
			name: 5,
			usage: 'sometimes',
			pinnedProperties: 'all',
		})

		expect(text.name).toBe('Text')
		expect(text.usage).toBe(ButtonGraphicsElementUsage.Automatic)
		expect(text.pinnedProperties).toEqual(getDefaultPinnedProperties('text'))
	})

	test('a group without children is empty', () => {
		expect(ButtonGraphicsGroupElementSchema.parse({ type: 'group', id: 'g1' }).children).toEqual([])
	})

	test('parses the children of a group, at any depth', () => {
		const group = ButtonGraphicsGroupElementSchema.parse({
			type: 'group',
			id: 'g1',
			children: [{ type: 'group', id: 'g2', children: [{ type: 'box', id: 'b1' }] }],
		})

		const inner = group.children[0]
		expect(inner.type).toBe('group')
		if (inner.type !== 'group') return
		expect(inner.children[0]).toMatchObject({ type: 'box', id: 'b1', cornerRadius: expect.any(Object) })
	})

	test('a composite element keeps the options of its definition', () => {
		const composite = ButtonGraphicsCompositeElementSchema.parse({
			type: 'composite',
			id: 'c1',
			connectionId: 'conn1',
			elementId: 'meter',
			'opt:level': { isExpression: false, value: 3 },
		})

		expect(composite['opt:level']).toEqual({ isExpression: false, value: 3 })
	})

	test('rejects an element of an unknown type, or without its identity', () => {
		expect(SomeButtonGraphicsElementSchema.safeParse({ type: 'sparkle', id: 'x' }).success).toBe(false)
		expect(SomeButtonGraphicsElementSchema.safeParse({ type: 'text' }).success).toBe(false)
		expect(SomeButtonGraphicsElementSchema.safeParse({ type: 'composite', id: 'c1', elementId: 'meter' }).success).toBe(
			false
		)
	})

	test('parsing a parsed element changes nothing', () => {
		const once = SomeButtonGraphicsElementSchema.parse({ type: 'gauge', id: 'g1' })

		expect(SomeButtonGraphicsElementSchema.parse(once)).toEqual(once)
	})
})
