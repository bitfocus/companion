import { describe, expect, test } from 'vitest'
import z from 'zod'
import { SomeControlModelSchema } from '@companion-app/shared/Model/Controls.js'
import { INVALID_ENTITY_DEFINITION_ID } from '@companion-app/shared/Model/EntityModel.js'
import { AuthorableInputFieldSchema, INPUT_FIELD_ID_PATTERN } from '@companion-app/shared/Model/Options.js'
import { repairControl } from '../../lib/Controls/ControlRepair.js'

const action = { type: 'action', id: 'a1', definitionId: 'send', connectionId: 'conn1', options: {} }
const feedback = { type: 'feedback', id: 'f1', definitionId: 'state', connectionId: 'conn1', options: {} }

/** A control with input fields, as no control has them yet */
const ControlWithInputsSchema = z.object({
	type: z.literal('with-inputs'),
	inputs: z.array(AuthorableInputFieldSchema),
})

/** Parse a control, repairing it if it fails, and check the result then parses */
function parseRepaired(control: unknown, schema: z.ZodType = SomeControlModelSchema) {
	const first = schema.safeParse(control)
	expect(first.success, 'the control should start invalid').toBe(false)
	if (first.success) throw new Error('unreachable')

	const result = repairControl(control, first.error.issues)
	if (!result) return null

	const second = schema.safeParse(result.control)
	expect(second.error).toBeUndefined()
	return { control: second.data as any, repairs: result.repairs }
}

function placeholderOf(original: unknown, type: 'action' | 'feedback', id: string) {
	return {
		type,
		id,
		connectionId: 'internal',
		definitionId: INVALID_ENTITY_DEFINITION_ID,
		disabled: true,
		options: { original: { isExpression: false, value: original } },
	}
}

describe('repairControl', () => {
	describe('entities', () => {
		test('replaces an invalid action in a step, keeping the rest of the button', () => {
			const broken = { ...action, id: 'a2', connectionId: 5 }
			const result = parseRepaired({
				type: 'button-layered',
				steps: { '0': { action_sets: { down: [action, broken], up: [action] } } },
				style: { layers: [{ type: 'canvas', id: 'canvas' }] },
			})

			const down = result!.control.steps['0'].action_sets.down
			expect(down[0]).toMatchObject({ id: 'a1', definitionId: 'send' })
			expect(down[1]).toMatchObject(placeholderOf(broken, 'action', 'a2'))
			expect(result!.control.steps['0'].action_sets.up).toHaveLength(1)
			expect(result!.repairs).toEqual(['Replaced the action at steps.0.action_sets.down.1'])
		})

		test('replaces an invalid action in a hold duration set', () => {
			const broken = { ...action, id: 'held', options: 'none' }
			const result = parseRepaired({
				type: 'button-layered',
				steps: { '0': { action_sets: { down: [], up: [], '500': [broken] } } },
			})

			expect(result!.control.steps['0'].action_sets['500'][0]).toMatchObject(placeholderOf(broken, 'action', 'held'))
		})

		test('replaces an invalid feedback or local variable', () => {
			const result = parseRepaired({
				type: 'button-layered',
				feedbacks: [feedback, { ...feedback, id: 'f2', definitionId: 3 }],
				localVariables: [{ ...feedback, id: 'v1', variableName: 7 }],
			})

			expect(result!.control.feedbacks[0]).toMatchObject({ id: 'f1', definitionId: 'state' })
			expect(result!.control.feedbacks[1]).toMatchObject({
				type: 'feedback',
				definitionId: INVALID_ENTITY_DEFINITION_ID,
			})
			expect(result!.control.localVariables[0]).toMatchObject({ type: 'feedback', id: 'v1', disabled: true })
		})

		test('replaces only the invalid child of an entity', () => {
			const brokenChild = { ...action, id: 'child', definitionId: null }
			const result = parseRepaired({
				type: 'button-layered',
				steps: {
					'0': {
						action_sets: {
							down: [
								{ ...action, id: 'group', connectionId: 'internal', children: { default: [action, brokenChild] } },
							],
						},
					},
				},
			})

			const group = result!.control.steps['0'].action_sets.down[0]
			expect(group).toMatchObject({ id: 'group', connectionId: 'internal' })
			expect(group.children.default[0]).toMatchObject({ id: 'a1' })
			expect(group.children.default[1]).toMatchObject(placeholderOf(brokenChild, 'action', 'child'))
		})

		test('replaces an invalid action, condition or local variable of a trigger', () => {
			const result = parseRepaired({
				type: 'trigger',
				actions: [{ ...action, id: 5 }],
				condition: [{ ...feedback, isInverted: 'yes' }],
				localVariables: [feedback],
			})

			expect(result!.control.actions[0]).toMatchObject({ type: 'action', definitionId: INVALID_ENTITY_DEFINITION_ID })
			expect(result!.control.condition[0]).toMatchObject({ type: 'feedback', id: 'f1', disabled: true })
			expect(result!.control.localVariables[0]).toMatchObject({ id: 'f1', definitionId: 'state' })
		})

		test('replaces the invalid entity of an expression variable', () => {
			const result = parseRepaired({ type: 'expression-variable', entity: { ...feedback, options: [] } })

			expect(result!.control.entity).toMatchObject({ type: 'feedback', id: 'f1', disabled: true })
		})

		test('gives an entity without a usable id a new one, and keeps something that is not an entity at all', () => {
			const result = parseRepaired({ type: 'button-layered', feedbacks: ['not an entity'] })

			expect(result!.control.feedbacks[0]).toMatchObject({
				type: 'feedback',
				id: expect.any(String),
				options: { original: { isExpression: false, value: 'not an entity' } },
			})
			expect(result!.control.feedbacks[0].headline).toBe("Couldn't be loaded")
		})

		test("keeps an entity's note, or else names what it was", () => {
			const result = parseRepaired({
				type: 'button-layered',
				feedbacks: [
					{ ...feedback, id: 'f2', headline: 'Tally', options: 'bad' },
					{ ...feedback, id: 'f3', options: 'bad' },
				],
			})

			expect(result!.control.feedbacks[0].headline).toBe("Couldn't be loaded - Tally")
			expect(result!.control.feedbacks[1].headline).toBe("Couldn't be loaded - conn1: state")
		})
	})

	describe('style elements', () => {
		test('replaces an invalid element with an empty, disabled group', () => {
			const result = parseRepaired({
				type: 'button-layered',
				style: {
					layers: [
						{ type: 'canvas', id: 'canvas' },
						{ type: 'sparkle', id: 'odd', name: 'Glitter' },
					],
				},
			})

			const layers = result!.control.style.layers
			expect(layers[0]).toMatchObject({ type: 'canvas' })
			expect(layers[1]).toMatchObject({
				type: 'group',
				id: 'odd',
				name: 'Invalid - Glitter',
				enabled: { isExpression: false, value: false },
				children: [],
			})
			expect(result!.repairs).toEqual(['Replaced the style element at style.layers.1'])
		})

		test('replaces only the invalid child of a group', () => {
			const result = parseRepaired({
				type: 'button-layered',
				style: {
					layers: [
						{
							type: 'group',
							id: 'g',
							children: [
								{ type: 'box', id: 'b1' },
								{ type: 'box', name: 'No id' },
							],
						},
					],
				},
			})

			const group = result!.control.style.layers[0]
			expect(group).toMatchObject({ type: 'group', id: 'g' })
			expect(group.children[0]).toMatchObject({ type: 'box', id: 'b1' })
			expect(group.children[1]).toMatchObject({ type: 'group', name: 'Invalid - No id' })
		})
	})

	describe('input fields', () => {
		const input = { type: 'number', id: 'n', label: 'N', default: 1, min: 0, max: 10 }

		test('replaces an invalid input with static text, keeping its id and the others', () => {
			const broken = { ...input, id: 'm', min: 'low' }
			const result = parseRepaired({ type: 'with-inputs', inputs: [input, broken] }, ControlWithInputsSchema)

			expect(result!.control.inputs).toEqual([
				input,
				{ type: 'static-text', id: 'm', label: "Couldn't be loaded - N", value: JSON.stringify(broken) },
			])
			expect(result!.repairs).toEqual(['Replaced the input at inputs.1'])
		})

		test('replaces an input which is a type of field that a user can not author', () => {
			const secret = { type: 'secret-text', id: 'key', label: 'Key' }
			const result = parseRepaired({ type: 'with-inputs', inputs: [secret, input] }, ControlWithInputsSchema)

			expect(result!.control.inputs.map((field: any) => [field.type, field.id])).toEqual([
				['static-text', 'key'],
				['number', 'n'],
			])
		})

		test('gives an input without a usable id a new one', () => {
			const result = parseRepaired(
				{ type: 'with-inputs', inputs: [{ ...input, id: 'not valid' }] },
				ControlWithInputsSchema
			)

			const placeholder = result!.control.inputs[0]
			expect(placeholder.type).toBe('static-text')
			expect(placeholder.id).not.toBe('not valid')
			expect(placeholder.id).toMatch(INPUT_FIELD_ID_PATTERN)
		})

		test('replaces something which is not an input at all', () => {
			const result = parseRepaired({ type: 'with-inputs', inputs: [7] }, ControlWithInputsSchema)

			expect(result!.control.inputs[0]).toMatchObject({ type: 'static-text', label: expect.any(String), value: '7' })
		})
	})

	test('repairs several problems at once', () => {
		const result = parseRepaired({
			type: 'button-layered',
			feedbacks: [{ ...feedback, id: 3 }],
			steps: { '0': { action_sets: { down: [{ ...action, connectionId: [] }] } } },
			style: { layers: [{ type: 'nope', id: 'x' }] },
		})

		expect(result!.repairs).toHaveLength(3)
	})

	test('cannot repair a control which is not an entity or element that failed', () => {
		expect(parseRepaired({ type: 'sparkle' })).toBeNull()
		expect(parseRepaired({ type: 'trigger', options: { enabled: 'sometimes' } })).toBeNull()
		expect(parseRepaired({ type: 'button-reference', options: {} })).toBeNull()
	})

	test('does not change the control it is given', () => {
		const control = { type: 'button-layered', feedbacks: [{ ...feedback, id: 3 }] }
		const issues = SomeControlModelSchema.safeParse(control).error!.issues

		repairControl(control, issues)

		expect(control.feedbacks[0]).toEqual({ ...feedback, id: 3 })
	})
})
