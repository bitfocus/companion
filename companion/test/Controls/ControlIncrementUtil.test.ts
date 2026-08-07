import { describe, expect, test } from 'vitest'
import type { SomeControlModel } from '@companion-app/shared/Model/Controls.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import {
	ButtonGraphicsDecorationType,
	ButtonGraphicsElementUsage,
	ButtonGraphicsShowStatusIcons,
} from '@companion-app/shared/Model/StyleModel.js'
import {
	getControlIncrementOptions,
	incrementControlModelFields,
} from '../../lib/Controls/ControlIncrementUtil.js'

function createControlModel(): SomeControlModel {
	return {
		type: 'button-layered',
		options: {
			stepProgression: 'auto',
			rotaryActions: false,
			canModifyStyleInApis: false,
		},
		style: {
			layers: [
				{
					id: 'canvas',
					name: 'Canvas',
					usage: ButtonGraphicsElementUsage.Automatic,
					type: 'canvas',
					decoration: { isExpression: false, value: ButtonGraphicsDecorationType.FollowDefault },
					showStatusIcons: { isExpression: false, value: ButtonGraphicsShowStatusIcons.FollowDefault },
				},
				{
					id: 'text0',
					name: 'Text',
					usage: ButtonGraphicsElementUsage.Automatic,
					type: 'text',
					enabled: { isExpression: false, value: true },
					opacity: { isExpression: false, value: 100 },
					x: { isExpression: false, value: 0 },
					y: { isExpression: false, value: 0 },
					width: { isExpression: false, value: 100 },
					height: { isExpression: false, value: 100 },
					rotation: { isExpression: false, value: 0 },
					text: { isExpression: false, value: 'CAM 001' },
					color: { isExpression: false, value: 0xffffff },
					outlineColor: { isExpression: false, value: 0 },
					halign: { isExpression: false, value: 'center' },
					valign: { isExpression: false, value: 'center' },
					fontsize: { isExpression: false, value: 'auto' },
					font: { isExpression: false, value: 'companion-sans' },
				},
			],
		},
		feedbacks: [
			{
				type: EntityModelType.Feedback,
				id: 'feedback-1',
				connectionId: 'video',
				definitionId: 'input_active',
				options: {
					input: { isExpression: false, value: 1 },
				},
				upgradeIndex: undefined,
			},
		],
		steps: {
			'0': {
				action_sets: {
					down: [
						{
							type: EntityModelType.Action,
							id: 'action-1',
							connectionId: 'video',
							definitionId: 'set_pgm',
							options: {
								input: { isExpression: false, value: 1 },
								aux: { isExpression: false, value: 'AUX 01' },
								expression: { isExpression: true, value: '$(internal:custom_1)' },
								color: { isExpression: false, value: '#ff0000' },
							},
							upgradeIndex: undefined,
						},
					],
					up: [],
					rotate_left: undefined,
					rotate_right: undefined,
				},
				options: {
					runWhileHeld: [],
				},
			},
		},
		localVariables: [
			{
				type: EntityModelType.Feedback,
				id: 'local-variable-1',
				connectionId: 'internal',
				definitionId: 'user_value',
				variableName: 'input',
				options: {
					persist_value: { isExpression: false, value: true },
					startup_value: { isExpression: false, value: 1 },
				},
				children: {},
				upgradeIndex: undefined,
			},
		],
	}
}

describe('ControlIncrementUtil', () => {
	test('finds incrementable options and label text, while skipping layout, expressions and colors', () => {
		const fields = getControlIncrementOptions(createControlModel())

		expect(fields).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ label: 'Press action 1 / input', currentValue: '1' }),
				expect.objectContaining({ label: 'Press action 1 / aux', currentValue: 'AUX 01' }),
				expect.objectContaining({ label: 'Feedback 1 / input', currentValue: '1' }),
				expect.objectContaining({ label: 'Local variable 1 (input) | startup value:', currentValue: '1' }),
				expect.objectContaining({ label: 'Button label "Text" / text', currentValue: 'CAM 001' }),
			])
		)

		expect(fields).not.toEqual(expect.arrayContaining([expect.objectContaining({ currentValue: '#ff0000' })]))
		expect(fields).not.toEqual(expect.arrayContaining([expect.objectContaining({ label: 'Button label "Text" / x' })]))
		expect(fields).not.toEqual(expect.arrayContaining([expect.objectContaining({ label: 'Press action 1 / expression' })]))
	})

	test('increments only selected fields and preserves zero padding in text values', () => {
		const model = createControlModel()
		const fields = getControlIncrementOptions(model)
		const inputField = fields.find((field) => field.label === 'Press action 1 / input')
		const auxField = fields.find((field) => field.label === 'Press action 1 / aux')
		const labelField = fields.find((field) => field.label === 'Button label "Text" / text')

		expect(inputField).toBeDefined()
		expect(auxField).toBeDefined()
		expect(labelField).toBeDefined()

		const result = incrementControlModelFields(model, [inputField!.id, auxField!.id, labelField!.id], 1) as any

		expect(result.steps['0'].action_sets.down[0].options.input.value).toBe(2)
		expect(result.steps['0'].action_sets.down[0].options.aux.value).toBe('AUX 02')
		expect(result.style.layers[1].text.value).toBe('CAM 002')
		expect(result.feedbacks[0].options.input.value).toBe(1)
		expect(result.style.layers[1].x.value).toBe(0)
	})
})
