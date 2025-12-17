import type { ExecuteExpressionResult } from '@companion-app/shared/Expression/ExpressionResult.js'
import {
	ButtonGraphicsDecorationType,
	type ButtonGraphicsDrawBounds,
	type ButtonGraphicsImageDrawElement,
	type ButtonGraphicsImageElement,
	type ButtonGraphicsTextDrawElement,
	type ButtonGraphicsTextElement,
	type ButtonGraphicsCanvasDrawElement,
	type ButtonGraphicsCanvasElement,
	type SomeButtonGraphicsDrawElement,
	type SomeButtonGraphicsElement,
	type MakeExpressionable,
	type ButtonGraphicsBoxDrawElement,
	type ButtonGraphicsBoxElement,
	type ButtonGraphicsGroupElement,
	type ButtonGraphicsGroupDrawElement,
	type ButtonGraphicsBorderProperties,
	type ButtonGraphicsLineElement,
	type ButtonGraphicsLineDrawElement,
	type ButtonGraphicsElementBase,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Expression.js'
import { assertNever } from '@companion-app/shared/Util.js'
import type { HorizontalAlignment, VerticalAlignment } from '@companion-app/shared/Graphics/Util.js'
import type { VariablesAndExpressionParser } from '../Variables/VariablesAndExpressionParser.js'
import { stringifyVariableValue, type VariableValue } from '@companion-app/shared/Model/Variables.js'
import type { DrawImageBuffer } from '@companion-app/shared/Model/StyleModel.js'

class ElementExpressionHelper<T extends ButtonGraphicsElementBase> {
	readonly #parser: VariablesAndExpressionParser
	readonly drawPixelBuffers: DrawPixelBuffers
	readonly #usedVariables = new Set<string>()

	readonly #element: T
	readonly #elementOverrides: ReadonlyMap<string, ExpressionOrValue<any>> | undefined

	readonly onlyEnabled: boolean

	constructor(
		parser: VariablesAndExpressionParser,
		drawPixelBuffers: DrawPixelBuffers,
		usedVariables: Set<string>,
		element: T,
		elementOverrides: ReadonlyMap<string, ExpressionOrValue<any>> | undefined,
		onlyEnabled: boolean
	) {
		this.#parser = parser
		this.drawPixelBuffers = drawPixelBuffers
		this.#usedVariables = usedVariables

		this.#element = element
		this.#elementOverrides = elementOverrides

		this.onlyEnabled = onlyEnabled
	}

	#executeExpressionAndTrackVariables(str: string, requiredType: string | undefined): ExecuteExpressionResult {
		const result = this.#parser.executeExpression(str, requiredType)

		// Track the variables used in the expression, even when it failed
		for (const variable of result.variableIds) {
			this.#usedVariables.add(variable)
		}

		return result
	}

	#parseVariablesInString(str: string, defaultValue: string): string {
		try {
			const result = this.#parser.parseVariables(str)

			// Track the variables used in the expression, even when it failed
			for (const variable of result.variableIds) {
				this.#usedVariables.add(variable)
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

		const result = this.#executeExpressionAndTrackVariables(value.value, undefined)
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
			return this.#parseVariablesInString(value.value, 'ERR')
		}
	}

	getNumber(propertyName: keyof T, defaultValue: number, scale = 1): number {
		const value = this.#getValue(propertyName)

		if (!value.isExpression) return value.value * scale

		const result = this.#executeExpressionAndTrackVariables(value.value, 'number')
		if (!result.ok) {
			return defaultValue
		}

		return Number(result.value) * scale
	}

	getString<TVal extends string | null | undefined>(propertyName: keyof T, defaultValue: TVal): TVal {
		const value = this.#getValue(propertyName)

		if (!value.isExpression) return value.value

		const result = this.#executeExpressionAndTrackVariables(value.value, 'string')
		if (!result.ok) {
			return defaultValue
		}

		if (typeof result.value !== 'string') {
			return defaultValue
		}

		return result.value as TVal
	}

	getEnum<TVal extends string>(propertyName: keyof T, values: TVal[], defaultValue: TVal): TVal {
		const value = this.#getValue(propertyName)

		let actualValue: TVal = value.value
		if (value.isExpression) {
			const result = this.#executeExpressionAndTrackVariables(value.value, 'string')
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

		const result = this.#executeExpressionAndTrackVariables(value.value, 'boolean')
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

		const result = this.#executeExpressionAndTrackVariables(value.value, 'string')
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

		const result = this.#executeExpressionAndTrackVariables(value.value, 'string')
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
type ElementExpressionHelperFactory = <T extends ButtonGraphicsElementBase>(element: T) => ElementExpressionHelper<T>

type DrawPixelBuffers = (imageBuffers: DrawImageBuffer[]) => Promise<string | undefined>

export async function ConvertSomeButtonGraphicsElementForDrawing(
	parser: VariablesAndExpressionParser,
	drawPixelBuffers: DrawPixelBuffers,
	elements: SomeButtonGraphicsElement[],
	feedbackOverrides: ReadonlyMap<string, ReadonlyMap<string, ExpressionOrValue<any>>>,
	onlyEnabled: boolean
): Promise<{
	elements: SomeButtonGraphicsDrawElement[]
	usedVariables: Set<string>
}> {
	const usedVariables = new Set<string>()

	const helperFactory: ElementExpressionHelperFactory = (element) =>
		new ElementExpressionHelper(
			parser,
			drawPixelBuffers,
			usedVariables,
			element,
			feedbackOverrides.get(element.id),
			onlyEnabled
		)

	const newElements = await ConvertSomeButtonGraphicsElementForDrawingWithHelper(helperFactory, elements)

	return {
		elements: newElements,
		usedVariables: usedVariables,
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
	if (base64Image) {
		const imageObjs = base64Image as unknown as DrawImageBuffer[]
		if (Array.isArray(imageObjs)) {
			// This is not very efficient, as it is not cached, but as this is a deprected feature, it is acceptable for now
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

	const fontsizeRaw = helper.getUnknown('fontsize', 'auto')
	const fontsize = Number(fontsizeRaw) || fontsizeRaw

	return {
		id: element.id,
		type: 'text',
		usage: element.usage,
		enabled,
		opacity: helper.getNumber('opacity', 1, 0.01),
		...convertDrawBounds(helper),
		text: helper.getDrawText('text') + '',
		fontsize: fontsize === 'auto' || typeof fontsize === 'number' ? fontsize : 'auto',
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
	helper: ElementExpressionHelper<
		MakeExpressionable<ButtonGraphicsDrawBounds & { type: string }> & ButtonGraphicsElementBase
	>
): ButtonGraphicsDrawBounds {
	return {
		x: helper.getNumber('x', 0, 0.01),
		y: helper.getNumber('y', 0, 0.01),
		width: helper.getNumber('width', 1, 0.01),
		height: helper.getNumber('height', 1, 0.01),
	}
}

function convertBorderProperties(
	helper: ElementExpressionHelper<
		MakeExpressionable<ButtonGraphicsBorderProperties & { type: string }> & ButtonGraphicsElementBase
	>
): ButtonGraphicsBorderProperties {
	return {
		borderWidth: helper.getNumber('borderWidth', 0, 0.01),
		borderColor: helper.getNumber('borderColor', 0),
		borderPosition: helper.getEnum('borderPosition', ['inside', 'center', 'outside'], 'inside'),
	}
}
