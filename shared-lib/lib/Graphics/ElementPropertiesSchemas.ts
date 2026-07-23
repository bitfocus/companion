import { CompanionFieldVariablesSupport, type SomeCompanionInputField } from '../Model/Options.js'
import type {
	ButtonGraphicsBoxElement,
	ButtonGraphicsGaugeElement,
	ButtonGraphicsImageElement,
	ButtonGraphicsTextElement,
} from '../Model/StyleLayersModel.js'
import { ButtonGraphicsDecorationType, ButtonGraphicsShowStatusIcons } from '../Model/StyleModel.js'

/**
 * Default font size (as a percentage of canvas height) used when "shrink to fit" is enabled.
 * At this value the shrink candidates match the behaviour of the old 'auto' mode.
 */
export const FONTSIZE_SHRINK_DEFAULT = 100

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
		min: -360,
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
	{ id: 'drawing', label: 'Drawing', fields: [...commonElementFields] },
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
				type: 'number',
				id: 'fontsize',
				label: 'Text Size',
				tooltip: 'The size of the text, in percentage of the element height.',
				min: 3,
				max: 200,
				default: FONTSIZE_SHRINK_DEFAULT,
				step: 1,
			},
			{
				type: 'checkbox',
				id: 'fontsizeAllowShrink',
				label: 'Shrink to fit',
				tooltip: 'Allow the text to shrink below the configured size when it is too long to fit.',
				default: true,
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
				enableAlpha: true,
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
	{ id: 'drawing', label: 'Drawing', fields: [...commonElementFields] },
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
	{ id: 'drawing', label: 'Drawing', fields: [...commonElementFields] },
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
	{ id: 'drawing', label: 'Drawing', fields: [...commonElementFields] },
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
	{ id: 'drawing', label: 'Drawing', fields: [...commonElementFields] },
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
	{ id: 'drawing', label: 'Drawing', fields: [...commonElementFields] },
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
	{ id: 'drawing', label: 'Drawing', fields: [...commonElementFields] },
	{ id: 'position', label: 'Position & Size', fields: [...boundsFields] },
]

export const referenceElementSchema: ElementSchemaSection[] = [
	{ id: 'drawing', label: 'Drawing', fields: [...commonElementFields] },
	{ id: 'position', label: 'Position & Size', fields: [...boundsFields, ...rotationFields] },
	{
		id: 'source',
		label: 'Source',
		fields: [
			{
				type: 'textinput',
				id: 'location',
				label: 'Location',
				tooltip:
					'The location of the button to reference, in the format "page/row/column" (e.g. "1/0/0" for page 1, row 0, column 0)',
				default: '',
				useVariables: CompanionFieldVariablesSupport.InternalParser,
			},
		],
	},
]

export const gaugeElementSchema: ElementSchemaSection[] = [
	{ id: 'drawing', label: 'Drawing', fields: [...commonElementFields] },
	{ id: 'position', label: 'Position & Size', fields: [...boundsFields, ...rotationFields] },
	{
		id: 'value',
		label: 'Value',
		fields: [
			{
				type: 'number',
				id: 'value',
				label: 'Value',
				tooltip: 'The current value of the gauge, in the Min..Max range defined below.',
				default: 0,
				min: -1000000,
				max: 1000000,
				step: 1,
			},
			{
				type: 'number',
				id: 'min',
				label: 'Minimum',
				tooltip: 'The value mapped to the start of the gauge.',
				default: 0,
				min: -1000000,
				max: 1000000,
				step: 1,
			},
			{
				type: 'number',
				id: 'max',
				label: 'Maximum',
				tooltip: 'The value mapped to the end of the gauge.',
				default: 100,
				min: -1000000,
				max: 1000000,
				step: 1,
			},
			{
				type: 'number',
				id: 'origin',
				label: 'Origin (0-point)',
				tooltip:
					'The value the fill grows from. Set to the Minimum for a normal bar, or to the midpoint for a bipolar (pan/centre) gauge.',
				default: 0,
				min: -1000000,
				max: 1000000,
				step: 1,
			},
			{
				type: 'checkbox',
				id: 'symmetric',
				label: 'Symmetric (mirror around origin)',
				tooltip:
					'When enabled the fill grows outward in both directions from the origin as the value rises (e.g. stereo width). When disabled the fill grows from the origin toward the value (e.g. pan).',
				default: false,
			},
		],
	},
	{
		id: 'appearance',
		label: 'Appearance',
		fields: [
			{
				type: 'dropdown',
				id: 'orientation',
				label: 'Orientation',
				choices: [
					{ id: 'horizontal', label: 'Horizontal' },
					{ id: 'vertical', label: 'Vertical' },
					{ id: 'ring', label: 'Ring' },
				],
				default: 'horizontal',
			},
			{
				type: 'checkbox',
				id: 'reverse',
				label: 'Reverse direction',
				tooltip:
					'When enabled, the gauge fills from the opposite end (right-to-left for horizontal, top-to-bottom for vertical, counter-clockwise for ring).',
				default: false,
			},
		],
	},
	{
		id: 'circular',
		label: 'Circular styling',
		fields: [
			{
				type: 'number',
				id: 'startAngle',
				label: 'Start angle',
				tooltip: 'Angle of the start of the arc, in degrees clockwise from the top. Only applies to ring orientation.',
				default: 0,
				min: 0,
				max: 360,
				step: 1,
			},
			{
				type: 'number',
				id: 'endAngle',
				label: 'End angle',
				tooltip:
					'Angle of the end of the arc, in degrees clockwise from the top. Any space between end and start becomes the gap. Only applies to ring orientation.',
				default: 360,
				min: 0,
				max: 360,
				step: 1,
			},
			{
				type: 'number',
				id: 'ringWidth',
				label: 'Ring width (%)',
				tooltip: 'Width of the ring as a percentage of the shorter dimension. Only applies to ring orientation.',
				default: 20,
				min: 1,
				max: 50,
				step: 1,
			},
			{
				type: 'checkbox',
				id: 'roundedEnds',
				label: 'Rounded ends',
				tooltip: 'Round the ends of the active arc. Only applies to ring orientation.',
				default: true,
			},
		],
	},
	{
		id: 'fill',
		label: 'Fill',
		fields: [
			{
				type: 'checkbox',
				id: 'fillEnabled',
				label: 'Show fill',
				tooltip: 'Draw the filled portion of the gauge.',
				default: true,
			},
			{
				type: 'checkbox',
				id: 'multiColour',
				label: 'Multi-color fill',
				tooltip:
					'When enabled, each color stop is visible in the filled portion. When disabled, only the active stop color is used for the entire filled area.',
				default: true,
			},
			{
				type: 'internal:list',
				id: 'stops',
				label: 'Color stops',
				tooltip:
					'Define color stops for the gauge fill. Each stop specifies the value at which that color starts. Enable "Gradient" to blend toward the next stop.',
				addLabel: 'Add stop',
				minItems: 1,
				fields: [
					{
						id: 'value',
						type: 'number',
						label: 'Value',
						min: -1000000,
						max: 1000000,
						step: 1,
						default: 0,
					},
					{
						id: 'color',
						type: 'colorpicker',
						label: 'Color',
						default: 0x00ff00,
						enableAlpha: false,
						returnType: 'number',
					},
					{
						id: 'gradient',
						type: 'checkbox',
						label: 'Gradient to next',
						default: false,
					},
				],
				default: [
					{ value: 0, color: 0x00ff00, gradient: false },
					{ value: 66, color: 0xffff00, gradient: false },
					{ value: 85, color: 0xff0000, gradient: false },
				],
			},
		],
	},
	{
		id: 'marker',
		label: 'Marker',
		fields: [
			{
				type: 'checkbox',
				id: 'markerEnabled',
				label: 'Show marker',
				tooltip: 'Draw a marker line at the current value, across the full width of the fill.',
				default: false,
			},
			{
				type: 'colorpicker',
				id: 'markerColor',
				label: 'Color',
				default: 0xffffff,
				enableAlpha: true,
				returnType: 'number',
			},
			{
				type: 'number',
				id: 'markerWidth',
				label: 'Width (%)',
				tooltip: 'Thickness of the marker line as a percentage of the fill width.',
				default: 15,
				min: 1,
				max: 100,
				step: 1,
			},
		],
	},
	{
		id: 'track',
		label: 'Track (background)',
		fields: [
			{
				type: 'dropdown',
				id: 'trackStyle',
				label: 'Style',
				tooltip: 'How to render the unfilled track behind the fill.',
				choices: [
					{ id: 'transparent', label: 'Transparent' },
					{ id: 'dimmed', label: 'Dimmed (darker)' },
				],
				default: 'transparent',
			},
			{
				type: 'number',
				id: 'trackAmount',
				label: 'Amount (%)',
				tooltip:
					'How much of the original color remains in the unfilled track. 0 = invisible / black, 100 = same as the active color.',
				default: 70,
				min: 0,
				max: 100,
				step: 1,
				range: true,
			},
			{
				type: 'number',
				id: 'trackWidth',
				label: 'Track width (%)',
				tooltip: 'Width of the track relative to the available space, centred.',
				default: 100,
				min: 0,
				max: 100,
				step: 1,
				range: true,
			},
		],
	},
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
	reference: referenceElementSchema,
	gauge: gaugeElementSchema,
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
		'fontsizeAllowShrink',
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
	gauge: [
		//
		'value',
	] satisfies ReadonlyArray<keyof ButtonGraphicsGaugeElement>,
} as const
