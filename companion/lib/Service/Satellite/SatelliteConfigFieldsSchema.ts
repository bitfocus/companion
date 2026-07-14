import { z } from 'zod'

export const CommonFieldsSchema = z
	.object({
		id: z.string().describe('Unique identifier for the field. Used as the key in the DEVICE-CONFIG JSON object.'),
		label: z.string().describe('Human-readable label shown in the UI.'),
		description: z.string().optional().describe('Optional longer description shown in the UI to explain the field.'),
		tooltip: z.string().optional().describe('Optional tooltip text shown on hover.'),
		isVisibleExpression: z
			.string()
			.optional()
			.describe(
				'Optional expression that controls field visibility. When provided, the field is only shown when the expression evaluates to true.'
			),
	})
	.meta({ id: 'CommonFields', title: 'CommonFields' })
export type CommonFields = z.infer<typeof CommonFieldsSchema>

export const DropdownChoiceSchema = z
	.object({
		id: z.union([z.string(), z.number()]).describe('The value stored when this choice is selected.'),
		label: z.string().describe('Human-readable label for the choice.'),
	})
	.meta({ id: 'DropdownChoice', title: 'DropdownChoice' })
export type DropdownChoice = z.infer<typeof DropdownChoiceSchema>

export const StaticTextFieldSchema = CommonFieldsSchema.extend({
	type: z.literal('static-text'),
	value: z.string().describe('Static text content to display.'),
}).meta({ id: 'StaticTextField', title: 'StaticTextField' })
export type StaticTextField = z.infer<typeof StaticTextFieldSchema>

export const TextInputFieldSchema = CommonFieldsSchema.extend({
	type: z.literal('textinput'),
	default: z.string().optional().describe('Default value.'),
	regex: z.string().optional().describe('Optional regex pattern the value must match.'),
	multiline: z.boolean().optional().describe('Whether the input is a multiline text area.'),
}).meta({ id: 'TextInputField', title: 'TextInputField' })
export type TextInputField = z.infer<typeof TextInputFieldSchema>

export const DropdownFieldSchema = CommonFieldsSchema.extend({
	type: z.literal('dropdown'),
	choices: z.array(DropdownChoiceSchema).min(1).describe('List of selectable choices.'),
	default: z.union([z.string(), z.number()]).optional().describe('Default selected choice id.'),
	allowCustom: z.boolean().optional().describe('Whether the user can type a custom value not in the choices list.'),
}).meta({ id: 'DropdownField', title: 'DropdownField' })
export type DropdownField = z.infer<typeof DropdownFieldSchema>

export const NumberFieldSchema = CommonFieldsSchema.extend({
	type: z.literal('number'),
	min: z.number().describe('Minimum allowed value.'),
	max: z.number().describe('Maximum allowed value.'),
	default: z.number().optional().describe('Default value.'),
	step: z.number().optional().describe('Step increment for the input.'),
}).meta({ id: 'NumberField', title: 'NumberField' })
export type NumberField = z.infer<typeof NumberFieldSchema>

export const CheckboxFieldSchema = CommonFieldsSchema.extend({
	type: z.literal('checkbox'),
	default: z.boolean().optional().describe('Default checked state.'),
}).meta({ id: 'CheckboxField', title: 'CheckboxField' })
export type CheckboxField = z.infer<typeof CheckboxFieldSchema>

export const ConfigFieldSchema = z
	.discriminatedUnion('type', [
		StaticTextFieldSchema,
		TextInputFieldSchema,
		DropdownFieldSchema,
		NumberFieldSchema,
		CheckboxFieldSchema,
	])
	.meta({ id: 'ConfigField', title: 'ConfigField' })
export type ConfigField = z.infer<typeof ConfigFieldSchema>

export const SatelliteConfigFieldsSchema = z.array(ConfigFieldSchema).meta({
	title: 'Satellite Config Fields',
	description:
		'Schema describing an array of custom config field definitions for a satellite device. These fields are rendered in the Companion UI surface settings panel and the stored values are pushed back to the device via DEVICE-CONFIG.',
})
export type SatelliteConfigFields = z.infer<typeof SatelliteConfigFieldsSchema>
