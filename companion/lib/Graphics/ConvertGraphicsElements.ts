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
	type ExpressionOrValue,
	type SomeButtonGraphicsDrawElement,
	type SomeButtonGraphicsElement,
	MakeExpressionable,
	ButtonGraphicsBoxDrawElement,
	ButtonGraphicsBoxElement,
	ButtonGraphicsGroupElement,
	ButtonGraphicsGroupDrawElement,
	ButtonGraphicsBorderProperties,
	ButtonGraphicsLineElement,
	ButtonGraphicsLineDrawElement,
	ButtonGraphicsElementBase,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import { assertNever } from '@companion-app/shared/Util.js'
import { HorizontalAlignment, VerticalAlignment } from '@companion-app/shared/Graphics/Util.js'

type ExecuteExpressionFn = (str: string, requiredType?: string) => Promise<ExecuteExpressionResult>
type ParseVariablesFn = (str: string) => Promise<ExecuteExpressionResult>

class ElementExpressionHelper<T extends ButtonGraphicsElementBase> {
	readonly #executeExpression: ExecuteExpressionFn
	readonly #parseVariables: ParseVariablesFn
	readonly #usedVariables = new Set<string>()

	readonly #element: T
	readonly #elementOverrides: ReadonlyMap<string, ExpressionOrValue<any>> | undefined

	readonly onlyEnabled: boolean

	constructor(
		executeExpression: ExecuteExpressionFn,
		parseVariables: ParseVariablesFn,
		usedVariables: Set<string>,
		element: T,
		elementOverrides: ReadonlyMap<string, ExpressionOrValue<any>> | undefined,
		onlyEnabled: boolean
	) {
		this.#executeExpression = executeExpression
		this.#parseVariables = parseVariables
		this.#usedVariables = usedVariables

		this.#element = element
		this.#elementOverrides = elementOverrides

		this.onlyEnabled = onlyEnabled
	}

	async #executeExpressionAndTrackVariables(
		str: string,
		requiredType: string | undefined
	): Promise<ExecuteExpressionResult> {
		const result = await this.#executeExpression(str, requiredType)

		// Track the variables used in the expression, even when it failed
		for (const variable of result.variableIds) {
			this.#usedVariables.add(variable)
		}

		return result
	}

	async #parseVariablesInString(str: string, defaultValue: string): Promise<string> {
		const result = await this.#parseVariables(str)

		// Track the variables used in the expression, even when it failed
		for (const variable of result.variableIds) {
			this.#usedVariables.add(variable)
		}

		if (!result.ok) {
			return defaultValue
		}

		return String(result.value)
	}

	#getValue(propertyName: keyof T): ExpressionOrValue<any> {
		const override = this.#elementOverrides?.get(String(propertyName))
		return override ? override : (this.#element as any)[propertyName]
	}

	async getUnknown(
		propertyName: keyof T,
		defaultValue: boolean | number | string | undefined
	): Promise<boolean | number | string | undefined> {
		const value = this.#getValue(propertyName)

		if (!value.isExpression) return value.value

		const result = await this.#executeExpressionAndTrackVariables(value.value, undefined)
		if (!result.ok) {
			return defaultValue
		}

		return result.value
	}

	async getDrawText(propertyName: keyof T): Promise<boolean | number | string | undefined> {
		const value = this.#getValue(propertyName)
		if (value.isExpression) {
			return this.getUnknown(propertyName, 'ERR')
		} else {
			return this.#parseVariablesInString(value.value, 'ERR')
		}
	}

	async getNumber(propertyName: keyof T, defaultValue: number, scale = 1): Promise<number> {
		const value = this.#getValue(propertyName)

		if (!value.isExpression) return value.value * scale

		const result = await this.#executeExpressionAndTrackVariables(value.value, 'number')
		if (!result.ok) {
			return defaultValue
		}

		return (result.value as number) * scale
	}

	async getString<TVal extends string | null | undefined>(propertyName: keyof T, defaultValue: TVal): Promise<TVal> {
		const value = this.#getValue(propertyName)

		if (!value.isExpression) return value.value

		const result = await this.#executeExpressionAndTrackVariables(value.value, 'string')
		if (!result.ok) {
			return defaultValue
		}

		return result.value as TVal
	}

	async getEnum<TVal extends string>(propertyName: keyof T, values: TVal[], defaultValue: TVal): Promise<TVal> {
		const value = this.#getValue(propertyName)

		let actualValue: TVal = value.value
		if (value.isExpression) {
			const result = await this.#executeExpressionAndTrackVariables(value.value, 'string')
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

	async getBoolean(propertyName: keyof T, defaultValue: boolean): Promise<boolean> {
		const value = this.#getValue(propertyName)

		if (!value.isExpression) return value.value

		const result = await this.#executeExpressionAndTrackVariables(value.value, 'boolean')
		if (!result.ok) {
			return defaultValue
		}

		return result.value as boolean
	}

	async getHorizontalAlignment(propertyName: keyof T): Promise<HorizontalAlignment> {
		const value = this.#getValue(propertyName)

		if (!value.isExpression) {
			return this.getEnum<HorizontalAlignment>(propertyName, ['left', 'center', 'right'], 'center')
		}

		const result = await this.#executeExpressionAndTrackVariables(value.value, 'string')
		if (!result.ok) return 'center'

		const firstChar = String(result.value).trim().toLowerCase()[0]
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
	async getVerticalAlignment(propertyName: keyof T): Promise<VerticalAlignment> {
		const value = this.#getValue(propertyName)

		if (!value.isExpression) {
			return this.getEnum<VerticalAlignment>(propertyName, ['top', 'center', 'bottom'], 'center')
		}

		const result = await this.#executeExpressionAndTrackVariables(value.value, 'string')
		if (!result.ok) return 'center'

		const firstChar = String(result.value).trim().toLowerCase()[0]
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

export async function ConvertSomeButtonGraphicsElementForDrawing(
	elements: SomeButtonGraphicsElement[],
	feedbackOverrides: ReadonlyMap<string, ReadonlyMap<string, ExpressionOrValue<any>>>,
	executeExpression: ExecuteExpressionFn,
	parseVariables: ParseVariablesFn,
	onlyEnabled: boolean
): Promise<{
	elements: SomeButtonGraphicsDrawElement[]
	usedVariables: Set<string>
}> {
	const usedVariables = new Set<string>()

	const helperFactory: ElementExpressionHelperFactory = (element) =>
		new ElementExpressionHelper(
			executeExpression,
			parseVariables,
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

async function convertCanvasElementForDrawing(
	helperFactory: ElementExpressionHelperFactory,
	element: ButtonGraphicsCanvasElement
): Promise<ButtonGraphicsCanvasDrawElement> {
	const helper = helperFactory(element)

	const [decoration] = await Promise.all([
		// helper.getNumber(element.color, 0),
		helper.getEnum(
			'decoration',
			Object.values(ButtonGraphicsDecorationType),
			ButtonGraphicsDecorationType.FollowDefault
		),
	])

	return {
		id: element.id,
		type: 'canvas',
		usage: element.usage,
		// color,
		decoration,
	}
}

async function convertGroupElementForDrawing(
	helperFactory: ElementExpressionHelperFactory,
	element: ButtonGraphicsGroupElement
): Promise<ButtonGraphicsGroupDrawElement | null> {
	const helper = helperFactory(element)

	// Perform enabled check first, to avoid executing expressions when not needed
	const enabled = await helper.getBoolean('enabled', true)
	if (!enabled && helper.onlyEnabled) return null

	const [opacity, bounds, children] = await Promise.all([
		helper.getNumber('opacity', 1, 0.01),
		convertDrawBounds(helper),
		ConvertSomeButtonGraphicsElementForDrawingWithHelper(helperFactory, element.children),
	])

	return {
		id: element.id,
		type: 'group',
		usage: element.usage,
		enabled,
		opacity,
		...bounds,
		children,
	}
}

async function convertImageElementForDrawing(
	helperFactory: ElementExpressionHelperFactory,
	element: ButtonGraphicsImageElement
): Promise<ButtonGraphicsImageDrawElement | null> {
	const helper = helperFactory(element)

	// Perform enabled check first, to avoid executing expressions when not needed
	const enabled = await helper.getBoolean('enabled', true)
	if (!enabled && helper.onlyEnabled) return null

	const [opacity, bounds, base64Image, halign, valign, fillMode] = await Promise.all([
		helper.getNumber('opacity', 1, 0.01),
		convertDrawBounds(helper),
		helper.getString<string | null>('base64Image', null),
		helper.getHorizontalAlignment('halign'),
		helper.getVerticalAlignment('valign'),
		helper.getEnum('fillMode', ['crop', 'fill', 'fit', 'fit_or_shrink'], 'fit_or_shrink'),
	])

	return {
		id: element.id,
		type: 'image',
		usage: element.usage,
		enabled,
		opacity,
		...bounds,
		base64Image,
		halign,
		valign,
		fillMode,
	}
}

async function convertTextElementForDrawing(
	helperFactory: ElementExpressionHelperFactory,
	element: ButtonGraphicsTextElement
): Promise<ButtonGraphicsTextDrawElement | null> {
	const helper = helperFactory(element)

	// Perform enabled check first, to avoid executing expressions when not needed
	const enabled = await helper.getBoolean('enabled', true)
	if (!enabled && helper.onlyEnabled) return null

	const [opacity, bounds, fontsizeRaw, text, color, halign, valign, outlineColor] = await Promise.all([
		helper.getNumber('opacity', 1, 0.01),
		convertDrawBounds(helper),
		helper.getUnknown('fontsize', 'auto'),
		helper.getDrawText('text'),
		helper.getNumber('color', 0),
		helper.getHorizontalAlignment('halign'),
		helper.getVerticalAlignment('valign'),
		helper.getNumber('outlineColor', 0),
	])

	const fontsize = Number(fontsizeRaw) || fontsizeRaw

	return {
		id: element.id,
		type: 'text',
		usage: element.usage,
		enabled,
		opacity,
		...bounds,
		text: text + '',
		fontsize: fontsize === 'auto' || typeof fontsize === 'number' ? fontsize : 'auto',
		color,
		halign,
		valign,
		outlineColor,
	}
}

async function convertBoxElementForDrawing(
	helperFactory: ElementExpressionHelperFactory,
	element: ButtonGraphicsBoxElement
): Promise<ButtonGraphicsBoxDrawElement | null> {
	const helper = helperFactory(element)

	// Perform enabled check first, to avoid executing expressions when not needed
	const enabled = await helper.getBoolean('enabled', true)
	if (!enabled && helper.onlyEnabled) return null

	const [opacity, bounds, color, borderProps] = await Promise.all([
		helper.getNumber('opacity', 1, 0.01),
		convertDrawBounds(helper),
		helper.getNumber('color', 0),
		convertBorderProperties(helper),
	])

	return {
		id: element.id,
		type: 'box',
		usage: element.usage,
		enabled,
		opacity,
		...bounds,
		color,
		...borderProps,
	}
}

async function convertLineElementForDrawing(
	helperFactory: ElementExpressionHelperFactory,
	element: ButtonGraphicsLineElement
): Promise<ButtonGraphicsLineDrawElement | null> {
	const helper = helperFactory(element)

	// Perform enabled check first, to avoid executing expressions when not needed
	const enabled = await helper.getBoolean('enabled', true)
	if (!enabled && helper.onlyEnabled) return null

	const [opacity, fromX, fromY, toX, toY, borderProps] = await Promise.all([
		helper.getNumber('opacity', 1, 0.01),
		helper.getNumber('fromX', 0),
		helper.getNumber('fromY', 0),
		helper.getNumber('toX', 100),
		helper.getNumber('toY', 100),
		convertBorderProperties(helper),
	])

	return {
		id: element.id,
		type: 'line',
		usage: element.usage,
		enabled,
		opacity,
		fromX,
		fromY,
		toX,
		toY,
		...borderProps,
	}
}

async function convertDrawBounds(
	helper: ElementExpressionHelper<
		MakeExpressionable<ButtonGraphicsDrawBounds & { type: string }> & ButtonGraphicsElementBase
	>
): Promise<ButtonGraphicsDrawBounds> {
	const [x, y, width, height] = await Promise.all([
		helper.getNumber('x', 0, 0.01),
		helper.getNumber('y', 0, 0.01),
		helper.getNumber('width', 1, 0.01),
		helper.getNumber('height', 1, 0.01),
	])

	return { x, y, width, height }
}

async function convertBorderProperties(
	helper: ElementExpressionHelper<
		MakeExpressionable<ButtonGraphicsBorderProperties & { type: string }> & ButtonGraphicsElementBase
	>
): Promise<ButtonGraphicsBorderProperties> {
	const [borderWidth, borderColor, borderPosition] = await Promise.all([
		helper.getNumber('borderWidth', 0, 0.01),
		helper.getNumber('borderColor', 0),
		helper.getEnum('borderPosition', ['inside', 'center', 'outside'], 'inside'),
	])

	return { borderWidth, borderColor, borderPosition }
}
