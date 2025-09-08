import type { SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'

// Base schema fields that are common to all elements (from ElementCommonProperties)
export const commonElementFields: SomeCompanionInputField[] = [
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

// Bounds properties fields (from ElementBoundsProperties)
export const boundsFields: SomeCompanionInputField[] = [
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

// Border properties fields (from BorderPropertiesEditor)
export const borderFields: SomeCompanionInputField[] = [
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
		choices: [
			{ id: 'inside', label: 'Inside' },
			{ id: 'center', label: 'Center' },
			{ id: 'outside', label: 'Outside' },
		],
		default: 'inside',
	},
]

// Text element schema (from TextElementPropertiesEditor)
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
		// Note: isExpression support not available in schema but used in actual implementation
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
		choices: [
			{ id: 'left', label: 'Left' },
			{ id: 'center', label: 'Center' },
			{ id: 'right', label: 'Right' },
		],
		default: 'center',
	},
	// Note: VerticalAlignmentInputField cannot be expressed with existing schemas
	// This would be a custom button group component with top/center/bottom icons
	{
		type: 'dropdown',
		id: 'valign',
		label: 'Vertical Alignment',
		choices: [
			{ id: 'top', label: 'Top' },
			{ id: 'center', label: 'Center' },
			{ id: 'bottom', label: 'Bottom' },
		],
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
		choices: [
			{ id: 'left', label: 'Left' },
			{ id: 'center', label: 'Center' },
			{ id: 'right', label: 'Right' },
		],
		default: 'center',
	},
	// Note: VerticalAlignmentInputField cannot be expressed with existing schemas
	{
		type: 'dropdown',
		id: 'valign',
		label: 'Vertical Alignment',
		choices: [
			{ id: 'top', label: 'Top' },
			{ id: 'center', label: 'Center' },
			{ id: 'bottom', label: 'Bottom' },
		],
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

// Box element schema (from BoxElementPropertiesEditor)
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

// Line element schema (from LineElementPropertiesEditor)
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
	// Border properties but labeled as "Line" instead of "Border"
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
		choices: [
			{ id: 'inside', label: 'Inside' },
			{ id: 'center', label: 'Center' },
			{ id: 'outside', label: 'Outside' },
		],
		default: 'center',
	},
]

// Canvas element schema (from CanvasElementPropertiesEditor)
export const canvasElementSchema: SomeCompanionInputField[] = [
	// Note: Canvas elements do not get common properties like usage, enabled, opacity
	// Note: Commented out color field in the original component
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
			{ id: 'follow_default', label: 'Follow default' },
			{ id: 'top_bar', label: 'Top bar' },
			{ id: 'border', label: 'Border when pressed' },
			{ id: 'none', label: 'None' },
		],
		default: 'follow_default',
	},
]

// Group element schema (from GroupElementPropertiesEditor)
export const groupElementSchema: SomeCompanionInputField[] = [
	// Note: Group elements do not get usage property
	...commonElementFields,
	...boundsFields,
]

// Complete schema mapping for all element types
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
