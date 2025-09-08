import type { SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import {
	ButtonGraphicsDecorationType,
	type HorizontalAlignment,
	type VerticalAlignment,
	type LineOrientation,
} from '@companion-app/shared/Model/StyleLayersModel.js'

// Type-safe constants for alignment and border position values
const HORIZONTAL_ALIGNMENT_CHOICES = [
	{ id: 'left' satisfies HorizontalAlignment, label: 'Left' },
	{ id: 'center' satisfies HorizontalAlignment, label: 'Center' },
	{ id: 'right' satisfies HorizontalAlignment, label: 'Right' },
]

const VERTICAL_ALIGNMENT_CHOICES = [
	{ id: 'top' satisfies VerticalAlignment, label: 'Top' },
	{ id: 'center' satisfies VerticalAlignment, label: 'Center' },
	{ id: 'bottom' satisfies VerticalAlignment, label: 'Bottom' },
]

const LINE_ORIENTATION_CHOICES = [
	{ id: 'inside' satisfies LineOrientation, label: 'Inside' },
	{ id: 'center' satisfies LineOrientation, label: 'Center' },
	{ id: 'outside' satisfies LineOrientation, label: 'Outside' },
]

const commonElementFields: SomeCompanionInputField[] = [
	{
		type: 'checkbox',
		id: 'enabled',
		label: 'Enabled',
		default: true,
	},
	{
		type: 'number',
		id: 'opacity',
		label: 'Opacity',
		default: 100,
		min: 0,
		max: 100,
		step: 1,
		range: true,
	},
]

const boundsFields: SomeCompanionInputField[] = [
	{
		type: 'number',
		id: 'x',
		label: 'X',
		default: 0,
		min: -1000,
		max: 1000,
		step: 1,
	},
	{
		type: 'number',
		id: 'y',
		label: 'Y',
		default: 0,
		min: -1000,
		max: 1000,
		step: 1,
	},
	{
		type: 'number',
		id: 'width',
		label: 'Width',
		default: 100,
		min: 0,
		max: 1000,
		step: 1,
	},
	{
		type: 'number',
		id: 'height',
		label: 'Height',
		default: 100,
		min: 0,
		max: 1000,
		step: 1,
	},
]

const borderFields: SomeCompanionInputField[] = [
	{
		type: 'number',
		id: 'borderWidth',
		label: 'Border Width',
		default: 0,
		min: 0,
		max: 100,
		step: 1,
	},
	{
		type: 'colorpicker',
		id: 'borderColor',
		label: 'Border Color',
		default: 0x000000,
		returnType: 'number',
		enableAlpha: true,
	},
	{
		type: 'dropdown',
		id: 'borderPosition',
		label: 'Border Position',
		choices: LINE_ORIENTATION_CHOICES,
		default: 'inside',
	},
]

export const textElementSchema: SomeCompanionInputField[] = [
	...commonElementFields,
	...boundsFields,
	{
		type: 'textinput',
		id: 'text',
		label: 'Button text string',
		tooltip: "The text you see on the button you're working with. You can use variables, but not expressions.",
		default: '',
		useVariables: { local: true },
	},
	{
		type: 'dropdown',
		id: 'fontsize',
		label: 'Text Size',
		choices: [
			{ id: 'auto', label: 'Auto' },
			{ id: '10', label: '10%' },
			{ id: '15', label: '15%' },
			{ id: '25', label: '25%' },
			{ id: '33', label: '33%' },
			{ id: '50', label: '50%' },
			{ id: '100', label: '100%' },
		],
		default: 'auto',
		allowCustom: true,
		regex: '^0*(?:[3-9]|[1-9][0-9]|1[0-9]{2}|200)?$',
	},
	{
		type: 'colorpicker',
		id: 'color',
		label: 'Color',
		default: 0xffffff,
		returnType: 'number',
	},
	{
		type: 'colorpicker',
		id: 'outlineColor',
		label: 'Outline Color',
		default: 0x000000,
		returnType: 'number',
		enableAlpha: true,
	},
	// Note: HorizontalAlignmentInputField cannot be expressed with existing schemas
	// This would be a custom button group component with left/center/right icons
	{
		type: 'dropdown',
		id: 'halign',
		label: 'Horizontal Alignment',
		choices: HORIZONTAL_ALIGNMENT_CHOICES,
		default: 'center',
	},
	// Note: VerticalAlignmentInputField cannot be expressed with existing schemas
	// This would be a custom button group component with top/center/bottom icons
	{
		type: 'dropdown',
		id: 'valign',
		label: 'Vertical Alignment',
		choices: VERTICAL_ALIGNMENT_CHOICES,
		default: 'center',
	},
]

// Image element schema (from ImageElementPropertiesEditor)
export const imageElementSchema: SomeCompanionInputField[] = [
	...commonElementFields,
	...boundsFields,
	// Note: PNGInputField with file picker cannot be expressed with existing schemas
	// This would require a custom file upload component
	{
		type: 'static-text',
		id: 'base64Image',
		value: 'Image upload not supported in schema - requires custom PNGInputField component',
		label: 'Image',
	},
	// Note: HorizontalAlignmentInputField cannot be expressed with existing schemas
	{
		type: 'dropdown',
		id: 'halign',
		label: 'Horizontal Alignment',
		choices: HORIZONTAL_ALIGNMENT_CHOICES,
		default: 'center',
	},
	// Note: VerticalAlignmentInputField cannot be expressed with existing schemas
	{
		type: 'dropdown',
		id: 'valign',
		label: 'Vertical Alignment',
		choices: VERTICAL_ALIGNMENT_CHOICES,
		default: 'center',
	},
	{
		type: 'dropdown',
		id: 'fillMode',
		label: 'Fill Mode',
		choices: [
			{ id: 'fit_or_shrink', label: 'Fit or Shrink' },
			{ id: 'fit', label: 'Fit' },
			{ id: 'fill', label: 'Fill' },
			{ id: 'crop', label: 'Crop' },
		],
		default: 'fit_or_shrink',
	},
]

export const boxElementSchema: SomeCompanionInputField[] = [
	...commonElementFields,
	...boundsFields,
	{
		type: 'colorpicker',
		id: 'color',
		label: 'Color',
		default: 0x000000,
		returnType: 'number',
		enableAlpha: true,
	},
	...borderFields,
]

export const lineElementSchema: SomeCompanionInputField[] = [
	...commonElementFields,
	{
		type: 'number',
		id: 'fromX',
		label: 'From X',
		default: 0,
		min: 0,
		max: 100,
		step: 1,
	},
	{
		type: 'number',
		id: 'fromY',
		label: 'From Y',
		default: 0,
		min: 0,
		max: 100,
		step: 1,
	},
	{
		type: 'number',
		id: 'toX',
		label: 'To X',
		default: 100,
		min: 0,
		max: 100,
		step: 1,
	},
	{
		type: 'number',
		id: 'toY',
		label: 'To Y',
		default: 100,
		min: 0,
		max: 100,
		step: 1,
	},
	{
		type: 'number',
		id: 'borderWidth',
		label: 'Line Width',
		default: 1,
		min: 0,
		max: 100,
		step: 1,
	},
	{
		type: 'colorpicker',
		id: 'borderColor',
		label: 'Line Color',
		default: 0x000000,
		returnType: 'number',
		enableAlpha: true,
	},
	{
		type: 'dropdown',
		id: 'borderPosition',
		label: 'Line Position',
		choices: LINE_ORIENTATION_CHOICES,
		default: 'center',
	},
]

export const canvasElementSchema: SomeCompanionInputField[] = [
	// Note: Canvas elements do not get common properties
	// {
	//   type: 'colorpicker',
	//   id: 'color',
	//   label: 'Color',
	//   default: 0x000000,
	//   returnType: 'number',
	// },
	{
		type: 'dropdown',
		id: 'decoration',
		label: 'Decoration',
		choices: [
			{ id: ButtonGraphicsDecorationType.FollowDefault, label: 'Follow default' },
			{ id: ButtonGraphicsDecorationType.TopBar, label: 'Top bar' },
			{ id: ButtonGraphicsDecorationType.Border, label: 'Border when pressed' },
			{ id: ButtonGraphicsDecorationType.None, label: 'None' },
		],
		default: ButtonGraphicsDecorationType.FollowDefault,
	},
]

export const groupElementSchema: SomeCompanionInputField[] = [...commonElementFields, ...boundsFields]

export const elementSchemas = {
	text: textElementSchema,
	image: imageElementSchema,
	box: boxElementSchema,
	line: lineElementSchema,
	canvas: canvasElementSchema,
	group: groupElementSchema,
} as const

// Notes about limitations:
// 1. HorizontalAlignmentInputField and VerticalAlignmentInputField use custom icon button groups
//    which cannot be replicated with existing dropdown schemas
// 2. PNGInputField for image upload requires custom file handling not available in schemas
// 3. The complex button group with trash icon for image clearing cannot be expressed
// 4. Expression vs string mode for text fields is not supported in schemas
// 5. Local variables support in text fields may not work exactly the same way
// 6. The commented-out color field in canvas elements indicates incomplete implementation
// 7. Some conditional rendering (like usage field being excluded for canvas/group)
//    would need to be handled externally
