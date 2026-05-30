import { CompanionFieldVariablesSupport, type SomeCompanionInputField } from '../Model/Options.js'
import type {
	ButtonGraphicsBoxElement,
	ButtonGraphicsImageElement,
	ButtonGraphicsTextElement,
} from '../Model/StyleLayersModel.js'
import { ButtonGraphicsDecorationType, ButtonGraphicsShowStatusIcons } from '../Model/StyleModel.js'

// Type-safe constants for border position values
const LINE_ORIENTATION_CHOICES = [
	{ id: 'inside', label: 'Inside' },
	{ id: 'center', label: 'Center' },
	{ id: 'outside', label: 'Outside' },
]

export interface ElementSchemaSection {
	id: string
	label: string
	fields: SomeCompanionInputField[]
}

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

export const boundsFields: SomeCompanionInputField[] = [
	{
		type: 'number',
		id: 'x',
		label: 'X %',
		default: 0,
		min: -1000,
		max: 1000,
		step: 1,
	},
	{
		type: 'number',
		id: 'y',
		label: 'Y %',
		default: 0,
		min: -1000,
		max: 1000,
		step: 1,
	},
	{
		type: 'number',
		id: 'width',
		label: 'Width %',
		default: 100,
		min: 0,
		max: 1000,
		step: 1,
	},
	{
		type: 'number',
		id: 'height',
		label: 'Height %',
		default: 100,
		min: 0,
		max: 1000,
		step: 1,
	},
]

export const rotationFields: SomeCompanionInputField[] = [
	{
		type: 'number',
		id: 'rotation',
		label: 'Rotation (degrees)',
		default: 0,
		min: 0,
		max: 360,
		step: 1,
	},
]

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
		choices: LINE_ORIENTATION_CHOICES,
		default: 'inside',
	},
]

export const textElementSchema: ElementSchemaSection[] = [
	{ id: 'layer', label: 'Layer', fields: [...commonElementFields] },
	{ id: 'position', label: 'Position & Size', fields: [...boundsFields, ...rotationFields] },
	{
		id: 'content',
		label: 'Content',
		fields: [
			{
				type: 'textinput',
				id: 'text',
				label: 'Button text string',
				default: '',
				useVariables: CompanionFieldVariablesSupport.InternalParser,
			},
			// Future: maybe the below is an 'appearance' section?
			{
				type: 'dropdown',
				id: 'fontsize',
				label: 'Text Size',
				tooltip:
					'The size of the text, in percentage of the canvas height. You can use custom values or select one of the presets.',
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
				type: 'dropdown',
				id: 'font',
				label: 'Font',
				choices: [
					{ id: 'companion-sans', label: 'Default' },
					{ id: 'companion-mono', label: 'Monospace' },
				],
				default: 'companion-sans',
				disableAutoExpression: true, // I think this will just be confusing to know what values to provide..
			},
			{
				type: 'colorpicker',
				id: 'color',
				label: 'Color',
				default: 0xffffff,
				returnType: 'number',
				enableAlpha: false,
			},
			{
				type: 'colorpicker',
				id: 'outlineColor',
				label: 'Outline Color',
				default: 0x000000,
				returnType: 'number',
				enableAlpha: true,
			},
			{
				type: 'internal:horizontal-alignment',
				id: 'halign',
				label: 'Horizontal Alignment',
				default: 'center',
			},
			{
				type: 'internal:vertical-alignment',
				id: 'valign',
				label: 'Vertical Alignment',
				default: 'center',
			},
		],
	},
]

// Image element schema (from ImageElementPropertiesEditor)
export const imageElementSchema: ElementSchemaSection[] = [
	{ id: 'layer', label: 'Layer', fields: [...commonElementFields] },
	{ id: 'position', label: 'Position & Size', fields: [...boundsFields, ...rotationFields] },
	{
		id: 'content',
		label: 'Content',
		fields: [
			{
				type: 'internal:image-file',
				id: 'base64Image',
				label: 'Image',
				default: null,
				min: { width: 8, height: 8 },
				max: { width: 400, height: 400 },
			},
			// Future: maybe the below is an 'appearance' section?
			{
				type: 'internal:horizontal-alignment',
				id: 'halign',
				label: 'Horizontal Alignment',
				default: 'center',
			},
			{
				type: 'internal:vertical-alignment',
				id: 'valign',
				label: 'Vertical Alignment',
				default: 'center',
			},
			{
				type: 'dropdown',
				id: 'fillMode',
				label: 'Fill Mode',
				choices: [
					{ id: 'fit', label: 'Fit' },
					{ id: 'fill', label: 'Fill' },
					{ id: 'crop', label: 'Crop' },
				],
				default: 'fit',
			},
		],
	},
]

export const boxElementSchema: ElementSchemaSection[] = [
	{ id: 'layer', label: 'Layer', fields: [...commonElementFields] },
	{ id: 'position', label: 'Position & Size', fields: [...boundsFields, ...rotationFields] },
	{
		id: 'fill',
		label: 'Fill',
		fields: [
			{
				type: 'colorpicker',
				id: 'color',
				label: 'Color',
				default: 0x000000,
				returnType: 'number',
				enableAlpha: true,
			},
		],
	},
	{ id: 'border', label: 'Border', fields: [...borderFields] },
]

export const lineElementSchema: ElementSchemaSection[] = [
	{ id: 'layer', label: 'Layer', fields: [...commonElementFields] },
	{
		id: 'position',
		label: 'Position',
		fields: [
			{
				type: 'number',
				id: 'fromX',
				label: 'From X %',
				default: 0,
				min: 0,
				max: 100,
				step: 1,
			},
			{
				type: 'number',
				id: 'fromY',
				label: 'From Y %',
				default: 0,
				min: 0,
				max: 100,
				step: 1,
			},
			{
				type: 'number',
				id: 'toX',
				label: 'To X %',
				default: 100,
				min: 0,
				max: 100,
				step: 1,
			},
			{
				type: 'number',
				id: 'toY',
				label: 'To Y %',
				default: 100,
				min: 0,
				max: 100,
				step: 1,
			},
		],
	},
	{
		id: 'style',
		label: 'Style',
		fields: [
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
		],
	},
]

export const circleElementSchema: ElementSchemaSection[] = [
	{ id: 'layer', label: 'Layer', fields: [...commonElementFields] },
	{ id: 'position', label: 'Position & Size', fields: [...boundsFields] },
	{
		id: 'arc-fill',
		label: 'Arc & Fill',
		fields: [
			{
				type: 'colorpicker',
				id: 'color',
				label: 'Color',
				default: 0x000000,
				returnType: 'number',
				enableAlpha: true,
			},
			{
				type: 'number',
				id: 'startAngle',
				label: 'Start Angle',
				default: 0,
				min: 0,
				max: 360,
				step: 1,
			},
			{
				type: 'number',
				id: 'endAngle',
				label: 'End Angle',
				default: 360,
				min: 0,
				max: 360,
				step: 1,
			},
			{
				type: 'checkbox',
				id: 'drawSlice',
				label: 'Draw Slice',
				tooltip: 'If enabled, draws a pie-slice shape instead of an arc.',
				default: false,
			},
		],
	},
	{
		id: 'border',
		label: 'Border',
		fields: [
			...borderFields,
			{
				type: 'checkbox',
				id: 'borderOnlyArc',
				label: 'Border Only Arc segment',
				default: false,
			},
		],
	},
]

export const canvasElementSchema: ElementSchemaSection[] = [
	{
		id: 'properties',
		label: 'Properties',
		fields: [
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
			{
				type: 'dropdown',
				id: 'showStatusIcons',
				label: 'Show status icons',
				tooltip: 'Whether to show status icons in the top right corner of the button',
				choices: [
					{ id: ButtonGraphicsShowStatusIcons.FollowDefault, label: 'Follow default' },
					{ id: ButtonGraphicsShowStatusIcons.ShowAll, label: 'Show all' },
					{ id: ButtonGraphicsShowStatusIcons.None, label: 'None' },
				],
				default: ButtonGraphicsShowStatusIcons.FollowDefault,
			},
		],
	},
]

export const groupElementSchema: ElementSchemaSection[] = [
	{ id: 'layer', label: 'Layer', fields: [...commonElementFields] },
	{ id: 'position', label: 'Position & Size', fields: [...boundsFields, ...rotationFields] },
	{
		id: 'options',
		label: 'Options',
		fields: [
			{
				type: 'checkbox',
				id: 'squareCoords',
				label: 'Square Aspect Ratio',
				tooltip:
					'When enabled, the coordinate space for child elements is constrained to a square (using the shorter side), centered within the group. This prevents shapes like arrows from stretching when the button is not square.',
				default: false,
			},
		],
	},
]

export const compositeElementSchema: ElementSchemaSection[] = [
	{ id: 'layer', label: 'Layer', fields: [...commonElementFields] },
	{ id: 'position', label: 'Position & Size', fields: [...boundsFields] },
]

/**
 * Section-structured schemas per element type.
 */
export const elementSchemas = {
	text: textElementSchema,
	image: imageElementSchema,
	box: boxElementSchema,
	line: lineElementSchema,
	group: groupElementSchema,
	circle: circleElementSchema,
	composite: compositeElementSchema,
	canvas: canvasElementSchema,
} as const satisfies Record<string, ElementSchemaSection[]>

export function getElementSchemaProperty(
	elementType: keyof typeof elementSchemas | undefined,
	propertyId: string
): SomeCompanionInputField | null {
	if (!elementType) return null

	const schema = elementSchemas[elementType]
	if (!schema) return null

	for (const section of schema) {
		for (const field of section.fields) {
			if (field.id === propertyId) {
				return field
			}
		}
	}
	return null
}

/**
 * Fields to show for text elements when "simple mode" is enabled in the editor.
 */
export const elementSimpleModeFields = {
	text: [
		//
		'text',
		'fontsize',
		'color',
		'halign',
		'valign',
	] satisfies ReadonlyArray<keyof ButtonGraphicsTextElement>,
	image: [
		//
		'base64Image',
		'halign',
		'valign',
	] satisfies ReadonlyArray<keyof ButtonGraphicsImageElement>,
	box: [
		//
		'color',
	] satisfies ReadonlyArray<keyof ButtonGraphicsBoxElement>,
} as const
