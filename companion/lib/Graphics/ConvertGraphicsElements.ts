import type { ExecuteExpressionResult } from '@companion-app/shared/Expression/ExpressionResult.js'
import type {
	ButtonGraphicsDrawBounds,
	ButtonGraphicsImageDrawElement,
	ButtonGraphicsImageElement,
	ButtonGraphicsTextDrawElement,
	ButtonGraphicsTextElement,
	ButtonGraphicsCanvasDrawElement,
	ButtonGraphicsCanvasElement,
	SomeButtonGraphicsDrawElement,
	SomeButtonGraphicsElement,
	ButtonGraphicsBoxDrawElement,
	ButtonGraphicsBoxElement,
	ButtonGraphicsGroupElement,
	ButtonGraphicsGroupDrawElement,
	ButtonGraphicsLineElement,
	ButtonGraphicsLineDrawElement,
	ButtonGraphicsElementBase,
	ButtonGraphicsBounds,
	ButtonGraphicsCircleElement,
	ButtonGraphicsCircleDrawElement,
	ButtonGraphicsDrawBorder,
	ButtonGraphicsBorder,
	ButtonGraphicsCompositeElement,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Expression.js'
import { assertNever } from '@companion-app/shared/Util.js'
import type { HorizontalAlignment, VerticalAlignment } from '@companion-app/shared/Graphics/Util.js'
import type { VariablesAndExpressionParser } from '../Variables/VariablesAndExpressionParser.js'
import {
	ButtonGraphicsDecorationType,
	type CompositeElementOptionKey,
	type DrawImageBuffer,
} from '@companion-app/shared/Model/StyleModel.js'
import {
	stringifyVariableValue,
	type VariableValues,
	type VariableValue,
} from '@companion-app/shared/Model/Variables.js'
import type {
	InstanceDefinitions,
	CompositeElementDefinition,
	CompositeElementIdString,
} from '../Instance/Definitions.js'

interface ExpressionReferences {
	readonly variables: Set<string>
	readonly compositeElements: Set<CompositeElementIdString>
}

class ElementExpressionHelper<T> {
	readonly #compositeElementStore: InstanceDefinitions
	readonly #parser: VariablesAndExpressionParser
	readonly drawPixelBuffers: DrawPixelBuffers
	readonly #references: ExpressionReferences

	readonly #element: T
	readonly #elementOverrides: ReadonlyMap<string, ExpressionOrValue<any>> | undefined

	readonly onlyEnabled: boolean

	constructor(
		compositeElementStore: InstanceDefinitions,
		parser: VariablesAndExpressionParser,
		drawPixelBuffers: DrawPixelBuffers,
		references: ExpressionReferences,
		element: T,
		elementOverrides: ReadonlyMap<string, ExpressionOrValue<any>> | undefined,
		onlyEnabled: boolean
	) {
		this.#compositeElementStore = compositeElementStore
		this.#parser = parser
		this.drawPixelBuffers = drawPixelBuffers
		this.#references = references

		this.#element = element
		this.#elementOverrides = elementOverrides

		this.onlyEnabled = onlyEnabled
	}

	resolveCompositeElement(connectionId: string, elementId: string): CompositeElementDefinition | null {
		this.#references.compositeElements.add(`${connectionId}:${elementId}`)

		const definition = this.#compositeElementStore.getCompositeElementDefinition(connectionId, elementId)
		return definition ?? null
	}

	executeExpressionAndTrackVariables(str: string, requiredType: string | undefined): ExecuteExpressionResult {
		const result = this.#parser.executeExpression(str, requiredType)

		// Track the variables used in the expression, even when it failed
		for (const variable of result.variableIds) {
			this.#references.variables.add(variable)
		}

		return result
	}

	parseVariablesInString(str: string, defaultValue: string): string {
		try {
			const result = this.#parser.parseVariables(str)

			// Track the variables used
			for (const variable of result.variableIds) {
				this.#references.variables.add(variable)
			}

			return String(result.text)
		} catch (_e) {
			// Ignore errors
			return defaultValue
		}
	}

	#getValue(propertyName: keyof T): ExpressionOrValue<any> {
		const override = this.#elementOverrides?.get(String(propertyName))
		return override ? override : (this.#element as any)[propertyName]
	}

	getUnknown(propertyName: keyof T, defaultValue: VariableValue): VariableValue | undefined {
		const value = this.#getValue(propertyName)

		if (!value.isExpression) return value.value

		const result = this.executeExpressionAndTrackVariables(value.value, undefined)
		if (!result.ok) {
			return defaultValue
		}

		return result.value
	}

	getDrawText(propertyName: keyof T): string {
		const value = this.#getValue(propertyName)
		if (value.isExpression) {
			return stringifyVariableValue(this.getUnknown(propertyName, 'ERR')) ?? ''
		} else {
			return this.parseVariablesInString(value.value, 'ERR')
		}
	}

	getNumber(propertyName: keyof T, defaultValue: number, scale = 1): number {
		const value = this.#getValue(propertyName)

		if (!value.isExpression) return value.value * scale

		const result = this.executeExpressionAndTrackVariables(value.value, 'number')
		if (!result.ok) {
			return defaultValue
		}

		return Number(result.value) * scale
	}

	getString<TVal extends string | null | undefined>(propertyName: keyof T, defaultValue: TVal): TVal {
		const value = this.#getValue(propertyName)

		if (!value.isExpression) return value.value

		const result = this.executeExpressionAndTrackVariables(value.value, 'string')
		if (!result.ok) {
			return defaultValue
		}

		if (typeof result.value !== 'string') {
			return defaultValue
		}

		return result.value as TVal
	}

	getEnum<TVal extends string | number>(propertyName: keyof T, values: TVal[], defaultValue: TVal): TVal {
		const value = this.#getValue(propertyName)

		let actualValue: TVal = value.value
		if (value.isExpression) {
			const result = this.executeExpressionAndTrackVariables(value.value, 'string')
			if (!result.ok) {
				return defaultValue
			}
			actualValue = result.value as TVal
		}

		if (!values.includes(actualValue)) {
			return defaultValue
		}

		return actualValue
	}

	getBoolean(propertyName: keyof T, defaultValue: boolean): boolean {
		const value = this.#getValue(propertyName)

		if (!value.isExpression) return value.value

		const result = this.executeExpressionAndTrackVariables(value.value, 'boolean')
		if (!result.ok) {
			return defaultValue
		}

		return result.value as boolean
	}

	getHorizontalAlignment(propertyName: keyof T): HorizontalAlignment {
		const value = this.#getValue(propertyName)

		if (!value.isExpression) {
			return this.getEnum<HorizontalAlignment>(propertyName, ['left', 'center', 'right'], 'center')
		}

		const result = this.executeExpressionAndTrackVariables(value.value, 'string')
		if (!result.ok) return 'center'

		const firstChar = (stringifyVariableValue(result.value) ?? '').trim().toLowerCase()[0]
		switch (firstChar) {
			case 'l':
			case 's':
				return 'left'

			case 'r':
			case 'e':
				return 'right'

			default:
				return 'center'
		}
	}
	getVerticalAlignment(propertyName: keyof T): VerticalAlignment {
		const value = this.#getValue(propertyName)

		if (!value.isExpression) {
			return this.getEnum<VerticalAlignment>(propertyName, ['top', 'center', 'bottom'], 'center')
		}

		const result = this.executeExpressionAndTrackVariables(value.value, 'string')
		if (!result.ok) return 'center'

		const firstChar = (stringifyVariableValue(result.value) ?? '').trim().toLowerCase()[0]
		switch (firstChar) {
			case 't':
			case 's':
				return 'top'

			case 'b':
			case 'e':
				return 'bottom'

			default:
				return 'center'
		}
	}
}
type ElementExpressionHelperFactory = <T extends { readonly id: string }>(
	element: T,
	propOverrides?: VariableValues
) => ElementExpressionHelper<T>

type DrawPixelBuffers = (imageBuffers: DrawImageBuffer[]) => Promise<string | undefined>

export async function ConvertSomeButtonGraphicsElementForDrawing(
	compositeElementStore: InstanceDefinitions,
	parser: VariablesAndExpressionParser,
	drawPixelBuffers: DrawPixelBuffers,
	elements: SomeButtonGraphicsElement[],
	feedbackOverrides: ReadonlyMap<string, ReadonlyMap<string, ExpressionOrValue<any>>>,
	onlyEnabled: boolean
): Promise<{
	elements: SomeButtonGraphicsDrawElement[]
	usedVariables: Set<string>
	usedCompositeElements: Set<CompositeElementIdString>
}> {
	const references: ExpressionReferences = {
		variables: new Set(),
		compositeElements: new Set(),
	}

	const helperFactory: ElementExpressionHelperFactory = (element, propOverrides) =>
		new ElementExpressionHelper(
			compositeElementStore,
			propOverrides ? parser.createChildParser(propOverrides) : parser,
			drawPixelBuffers,
			references,
			element,
			feedbackOverrides.get(element.id),
			onlyEnabled
		)

	const newElements = await ConvertSomeButtonGraphicsElementForDrawingWithHelper(helperFactory, elements)

	return {
		elements: newElements,
		usedVariables: references.variables,
		usedCompositeElements: references.compositeElements,
	}
}

async function ConvertSomeButtonGraphicsElementForDrawingWithHelper(
	helperFactory: ElementExpressionHelperFactory,
	elements: SomeButtonGraphicsElement[]
): Promise<SomeButtonGraphicsDrawElement[]> {
	const newElements = await Promise.all(
		elements.map(async (element) => {
			switch (element.type) {
				case 'canvas':
					return convertCanvasElementForDrawing(helperFactory, element)
				case 'group':
					return convertGroupElementForDrawing(helperFactory, element)
				case 'image':
					return convertImageElementForDrawing(helperFactory, element)
				case 'text':
					return convertTextElementForDrawing(helperFactory, element)
				case 'box':
					return convertBoxElementForDrawing(helperFactory, element)
				case 'line':
					return convertLineElementForDrawing(helperFactory, element)
				case 'circle':
					return convertCircleElementForDrawing(helperFactory, element)
				case 'composite':
					return convertCompositeElementForDrawing(helperFactory, element)
				default:
					assertNever(element)
					return null
			}
		})
	)

	return newElements.filter((element) => element !== null)
}

function convertCanvasElementForDrawing(
	helperFactory: ElementExpressionHelperFactory,
	element: ButtonGraphicsCanvasElement
): ButtonGraphicsCanvasDrawElement {
	const helper = helperFactory(element)

	return {
		id: element.id,
		type: 'canvas',
		usage: element.usage,
		// color,
		decoration: helper.getEnum(
			'decoration',
			Object.values(ButtonGraphicsDecorationType),
			ButtonGraphicsDecorationType.FollowDefault
		),
	}
}

async function convertGroupElementForDrawing(
	helperFactory: ElementExpressionHelperFactory,
	element: ButtonGraphicsGroupElement
): Promise<ButtonGraphicsGroupDrawElement | null> {
	const helper = helperFactory(element)

	// Perform enabled check first, to avoid executing expressions when not needed
	const enabled = helper.getBoolean('enabled', true)
	if (!enabled && helper.onlyEnabled) return null

	const children = await ConvertSomeButtonGraphicsElementForDrawingWithHelper(helperFactory, element.children)

	return {
		id: element.id,
		type: 'group',
		usage: element.usage,
		enabled,
		opacity: helper.getNumber('opacity', 1, 0.01),
		...convertDrawBounds(helper),
		rotation: helper.getNumber('rotation', 0),
		children,
	}
}

async function convertCompositeElementForDrawing(
	helperFactory: ElementExpressionHelperFactory,
	element: ButtonGraphicsCompositeElement
): Promise<ButtonGraphicsGroupDrawElement | null> {
	const helper = helperFactory(element)

	// Perform enabled check first, to avoid executing expressions when not needed
	const enabled = helper.getBoolean('enabled', true)
	if (!enabled && helper.onlyEnabled) return null

	const opacity = helper.getNumber('opacity', 1, 0.01)
	const bounds = convertDrawBounds(helper)

	let children: SomeButtonGraphicsDrawElement[] = []

	const childElement = helper.resolveCompositeElement(element.connectionId, element.elementId)
	if (childElement) {
		// Inject new values
		const propOverrides: VariableValues = {}

		for (const option of childElement.options) {
			const optionKey: CompositeElementOptionKey = `opt:${option.id}`
			const overrideKey = `$(options:${option.id})`

			switch (option.type) {
				case 'checkbox':
					propOverrides[overrideKey] = helper.getBoolean(optionKey, option.default)
					break

				case 'textinput': {
					const rawValue = element[optionKey]
					if (!rawValue) {
						propOverrides[overrideKey] = option.default ?? ''
					} else if (option.isExpression || rawValue.isExpression) {
						const res = helper.executeExpressionAndTrackVariables(rawValue.value, undefined)
						propOverrides[overrideKey] = res.ok ? res.value : option.default
					} else if (option.useVariables) {
						propOverrides[overrideKey] = helper.parseVariablesInString(rawValue.value, option.default ?? '')
					} else {
						propOverrides[overrideKey] = String(rawValue.value)
					}
					break
				}

				case 'number':
					propOverrides[overrideKey] = helper.getNumber(optionKey, option.default ?? 0, 1)
					break

				case 'dropdown':
					propOverrides[overrideKey] = helper.getEnum(
						optionKey,
						option.choices.map((c) => c.id),
						option.default
					)
					break

				case 'colorpicker':
					if (option.returnType === 'string') {
						propOverrides[overrideKey] = helper.getString(optionKey, String(option.default))
					} else {
						propOverrides[overrideKey] = helper.getNumber(optionKey, Number(option.default) || 0, 1)
					}
					break

				case 'multidropdown':
				case 'internal:connection_collection':
				case 'internal:connection_id':
				case 'internal:custom_variable':
				case 'internal:date':
				case 'internal:time':
				case 'internal:horizontal-alignment':
				case 'internal:page':
				case 'internal:png-image':
				case 'internal:surface_serial':
				case 'internal:vertical-alignment':
				case 'internal:trigger':
				case 'internal:trigger_collection':
				case 'internal:variable':
				case 'secret-text':
				case 'static-text':
				case 'custom-variable':
				case 'bonjour-device':
					// Not supported
					break
				default:
					assertNever(option)
					// Ignore unknown type
					break
			}
		}

		// Inject the prop overrides into a new factory
		const childHelperFactory: ElementExpressionHelperFactory = (element, newPropOverrides) =>
			helperFactory(element, newPropOverrides ?? propOverrides)
		children = await ConvertSomeButtonGraphicsElementForDrawingWithHelper(childHelperFactory, childElement.elements)
	}

	return {
		id: element.id,
		type: 'group',
		usage: element.usage,
		enabled,
		opacity,
		...bounds,
		rotation: 0, // Not supported on composite elements
		children,
	}
}

async function convertImageElementForDrawing(
	helperFactory: ElementExpressionHelperFactory,
	element: ButtonGraphicsImageElement
): Promise<ButtonGraphicsImageDrawElement | null> {
	const helper = helperFactory(element)

	// Perform enabled check first, to avoid executing expressions when not needed
	const enabled = helper.getBoolean('enabled', true)
	if (!enabled && helper.onlyEnabled) return null

	let base64Image = helper.getString<string | null>('base64Image', null)
	// Hack: composite deprecated imageBuffers into a single base64 image
	if (base64Image) {
		const imageObjs = base64Image as unknown as DrawImageBuffer[]
		if (Array.isArray(imageObjs)) {
			// This is not very efficient, as it is not cached, but as this is a deprecated feature, it is acceptable for now
			base64Image = (await helper.drawPixelBuffers(imageObjs)) || null
		}
	}

	return {
		id: element.id,
		type: 'image',
		usage: element.usage,
		enabled,
		opacity: helper.getNumber('opacity', 1, 0.01),
		...convertDrawBounds(helper),
		rotation: helper.getNumber('rotation', 0),
		base64Image,
		halign: helper.getHorizontalAlignment('halign'),
		valign: helper.getVerticalAlignment('valign'),
		fillMode: helper.getEnum('fillMode', ['crop', 'fill', 'fit', 'fit_or_shrink'], 'fit_or_shrink'),
	}
}

function convertTextElementForDrawing(
	helperFactory: ElementExpressionHelperFactory,
	element: ButtonGraphicsTextElement
): ButtonGraphicsTextDrawElement | null {
	const helper = helperFactory(element)

	// Perform enabled check first, to avoid executing expressions when not needed
	const enabled = helper.getBoolean('enabled', true)
	if (!enabled && helper.onlyEnabled) return null

	return {
		id: element.id,
		type: 'text',
		usage: element.usage,
		enabled,
		opacity: helper.getNumber('opacity', 1, 0.01),
		...convertDrawBounds(helper),
		rotation: helper.getNumber('rotation', 0),
		text: helper.getDrawText('text') + '',
		fontsize: helper.getUnknown('fontsize', 'auto') as string,
		color: helper.getNumber('color', 0),
		halign: helper.getHorizontalAlignment('halign'),
		valign: helper.getVerticalAlignment('valign'),
		outlineColor: helper.getNumber('outlineColor', 0),
	}
}

function convertBoxElementForDrawing(
	helperFactory: ElementExpressionHelperFactory,
	element: ButtonGraphicsBoxElement
): ButtonGraphicsBoxDrawElement | null {
	const helper = helperFactory(element)

	// Perform enabled check first, to avoid executing expressions when not needed
	const enabled = helper.getBoolean('enabled', true)
	if (!enabled && helper.onlyEnabled) return null

	return {
		id: element.id,
		type: 'box',
		usage: element.usage,
		enabled,
		opacity: helper.getNumber('opacity', 1, 0.01),
		...convertDrawBounds(helper),
		rotation: helper.getNumber('rotation', 0),
		color: helper.getNumber('color', 0),

		...convertBorderProperties(helper),
	}
}

function convertLineElementForDrawing(
	helperFactory: ElementExpressionHelperFactory,
	element: ButtonGraphicsLineElement
): ButtonGraphicsLineDrawElement | null {
	const helper = helperFactory(element)

	// Perform enabled check first, to avoid executing expressions when not needed
	const enabled = helper.getBoolean('enabled', true)
	if (!enabled && helper.onlyEnabled) return null

	return {
		id: element.id,
		type: 'line',
		usage: element.usage,
		enabled,
		opacity: helper.getNumber('opacity', 1, 0.01),
		fromX: helper.getNumber('fromX', 0),
		fromY: helper.getNumber('fromY', 0),
		toX: helper.getNumber('toX', 100),
		toY: helper.getNumber('toY', 100),

		...convertBorderProperties(helper),
	}
}

function convertDrawBounds(
	helper: ElementExpressionHelper<ButtonGraphicsBounds & ButtonGraphicsElementBase>
): ButtonGraphicsDrawBounds {
	return {
		x: helper.getNumber('x', 0, 0.01),
		y: helper.getNumber('y', 0, 0.01),
		width: helper.getNumber('width', 1, 0.01),
		height: helper.getNumber('height', 1, 0.01),
	}
}

function convertCircleElementForDrawing(
	helperFactory: ElementExpressionHelperFactory,
	element: ButtonGraphicsCircleElement
): ButtonGraphicsCircleDrawElement | null {
	const helper = helperFactory(element)

	// Perform enabled check first, to avoid executing expressions when not needed
	const enabled = helper.getBoolean('enabled', true)
	if (!enabled && helper.onlyEnabled) return null

	return {
		id: element.id,
		type: 'circle',
		usage: element.usage,
		enabled,
		opacity: helper.getNumber('opacity', 1, 0.01),
		...convertDrawBounds(helper),
		color: helper.getNumber('color', 0),
		startAngle: helper.getNumber('startAngle', 0),
		endAngle: helper.getNumber('endAngle', 360),
		drawSlice: helper.getBoolean('drawSlice', false),
		...convertBorderProperties(helper),
		borderOnlyArc: helper.getBoolean('borderOnlyArc', false),
	}
}

function convertBorderProperties(
	helper: ElementExpressionHelper<ButtonGraphicsBorder & ButtonGraphicsElementBase>
): ButtonGraphicsDrawBorder {
	return {
		borderWidth: helper.getNumber('borderWidth', 0, 0.01),
		borderColor: helper.getNumber('borderColor', 0),
		borderPosition: helper.getEnum('borderPosition', ['inside', 'center', 'outside'], 'inside'),
	}
}
