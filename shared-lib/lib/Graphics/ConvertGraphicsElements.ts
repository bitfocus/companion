import type { ExecuteExpressionResult } from '../Expression/ExpressionResult.js'
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
} from '../Model/StyleLayersModel.js'
import { ALIGNMENT_OPTIONS } from '../Model/Alignment.js'
import { assertNever } from '../Util.js'

type ExecuteExpressionFn = (str: string, requiredType?: string) => Promise<ExecuteExpressionResult>

class ExpressionHelper {
	readonly #executeExpression: ExecuteExpressionFn

	readonly usedVariables = new Set<string>()
	readonly onlyEnabled: boolean

	constructor(executeExpression: ExecuteExpressionFn, onlyEnabled: boolean) {
		this.#executeExpression = executeExpression
		this.onlyEnabled = onlyEnabled
	}

	async #executeExpressionAndTrackVariables(
		str: string,
		requiredType: string | undefined
	): Promise<ExecuteExpressionResult> {
		const result = await this.#executeExpression(str, requiredType)

		// Track the variables used in the expression, even when it failed
		for (const variable of result.variableIds) {
			this.usedVariables.add(variable)
		}

		return result
	}

	async getUnknown(
		value: ExpressionOrValue<boolean | number | string | undefined>,
		defaultValue: boolean | number | string | undefined
	): Promise<boolean | number | string | undefined> {
		if (!value.isExpression) return value.value

		const result = await this.#executeExpressionAndTrackVariables(value.value, undefined)
		if (!result.ok) {
			return defaultValue
		}

		return result.value
	}

	async getNumber(value: ExpressionOrValue<number>, defaultValue: number): Promise<number> {
		if (!value.isExpression) return value.value

		const result = await this.#executeExpressionAndTrackVariables(value.value, 'number')
		if (!result.ok) {
			return defaultValue
		}

		return result.value as number
	}

	async getString<T extends string | null | undefined>(value: ExpressionOrValue<T>, defaultValue: T): Promise<T> {
		if (!value.isExpression) return value.value

		const result = await this.#executeExpressionAndTrackVariables(value.value, 'string')
		if (!result.ok) {
			return defaultValue
		}

		return result.value as T
	}

	async getEnum<T extends string>(value: ExpressionOrValue<T>, values: T[], defaultValue: T): Promise<T> {
		if (!value.isExpression) return value.value

		const result = await this.#executeExpressionAndTrackVariables(value.value, 'string')
		if (!result.ok) {
			return defaultValue
		}

		const strValue = result.value as string
		if (!values.includes(strValue as T)) {
			return defaultValue
		}

		return strValue as T
	}

	async getBoolean(value: ExpressionOrValue<boolean>, defaultValue: boolean): Promise<boolean> {
		if (!value.isExpression) return value.value

		const result = await this.#executeExpressionAndTrackVariables(value.value, 'boolean')
		if (!result.ok) {
			return defaultValue
		}

		return result.value as boolean
	}
}

export async function ConvertSomeButtonGraphicsElementForDrawing(
	elements: SomeButtonGraphicsElement[],
	executeExpression: ExecuteExpressionFn,
	onlyEnabled: boolean
): Promise<{
	elements: SomeButtonGraphicsDrawElement[]
	usedVariables: Set<string>
}> {
	const helper = new ExpressionHelper(executeExpression, onlyEnabled)

	const newElements = await ConvertSomeButtonGraphicsElementForDrawingWithHelper(helper, elements)

	return {
		elements: newElements,
		usedVariables: helper.usedVariables,
	}
}

async function ConvertSomeButtonGraphicsElementForDrawingWithHelper(
	helper: ExpressionHelper,
	elements: SomeButtonGraphicsElement[]
): Promise<SomeButtonGraphicsDrawElement[]> {
	const newElements = await Promise.all(
		elements.map((element) => {
			switch (element.type) {
				case 'canvas':
					return convertCanvasElementForDrawing(helper, element)
				case 'group':
					return convertGroupElementForDrawing(helper, element)
				case 'image':
					return convertImageElementForDrawing(helper, element)
				case 'text':
					return convertTextElementForDrawing(helper, element)
				case 'box':
					return convertBoxElementForDrawing(helper, element)
				default:
					assertNever(element)
					return null
			}
		})
	)

	return newElements.filter((element) => element !== null)
}

async function convertCanvasElementForDrawing(
	helper: ExpressionHelper,
	element: ButtonGraphicsCanvasElement
): Promise<ButtonGraphicsCanvasDrawElement> {
	const [decoration] = await Promise.all([
		// helper.getNumber(element.color, 0),
		helper.getEnum(
			element.decoration,
			Object.values(ButtonGraphicsDecorationType),
			ButtonGraphicsDecorationType.FollowDefault
		),
	])

	return {
		id: element.id,
		type: 'canvas',
		// color,
		decoration,
	}
}

async function convertGroupElementForDrawing(
	helper: ExpressionHelper,
	element: ButtonGraphicsGroupElement
): Promise<ButtonGraphicsGroupDrawElement | null> {
	// Perform enabled check first, to avoid executing expressions when not needed
	const enabled = await helper.getBoolean(element.enabled, true)
	if (!enabled && helper.onlyEnabled) return null

	const [opacity, bounds, children] = await Promise.all([
		helper.getNumber(element.opacity, 100),
		convertDrawBounds(helper, element),
		ConvertSomeButtonGraphicsElementForDrawingWithHelper(helper, element.children),
	])

	return {
		id: element.id,
		type: 'group',
		enabled,
		opacity,
		...bounds,
		children,
	}
}

async function convertImageElementForDrawing(
	helper: ExpressionHelper,
	element: ButtonGraphicsImageElement
): Promise<ButtonGraphicsImageDrawElement | null> {
	// Perform enabled check first, to avoid executing expressions when not needed
	const enabled = await helper.getBoolean(element.enabled, true)
	if (!enabled && helper.onlyEnabled) return null

	const [opacity, bounds, base64Image, alignment, fillMode] = await Promise.all([
		helper.getNumber(element.opacity, 100),
		convertDrawBounds(helper, element),
		helper.getString<string | null>(element.base64Image, null),
		helper.getEnum(element.alignment, ALIGNMENT_OPTIONS, 'center:center'),
		helper.getEnum(element.fillMode, ['crop', 'fill', 'fit', 'fit_or_shrink'], 'fit_or_shrink'),
	])

	return {
		id: element.id,
		type: 'image',
		enabled,
		opacity,
		...bounds,
		base64Image,
		alignment,
		fillMode,
	}
}

async function convertTextElementForDrawing(
	helper: ExpressionHelper,
	element: ButtonGraphicsTextElement
): Promise<ButtonGraphicsTextDrawElement | null> {
	// Perform enabled check first, to avoid executing expressions when not needed
	const enabled = await helper.getBoolean(element.enabled, true)
	if (!enabled && helper.onlyEnabled) return null

	const [opacity, bounds, fontsizeRaw, text, color, alignment] = await Promise.all([
		helper.getNumber(element.opacity, 100),
		convertDrawBounds(helper, element),
		helper.getUnknown(element.fontsize, 'auto'),
		helper.getUnknown(element.text, 'ERR'),
		helper.getNumber(element.color, 0),
		helper.getEnum(element.alignment, ALIGNMENT_OPTIONS, 'center:center'),
	])

	const fontsize = Number(fontsizeRaw) || fontsizeRaw

	return {
		id: element.id,
		type: 'text',
		enabled,
		opacity,
		...bounds,
		text: text + '',
		fontsize: fontsize === 'auto' || typeof fontsize === 'number' ? fontsize : 'auto',
		color,
		alignment,
	}
}

async function convertBoxElementForDrawing(
	helper: ExpressionHelper,
	element: ButtonGraphicsBoxElement
): Promise<ButtonGraphicsBoxDrawElement | null> {
	// Perform enabled check first, to avoid executing expressions when not needed
	const enabled = await helper.getBoolean(element.enabled, true)
	if (!enabled && helper.onlyEnabled) return null

	const [opacity, bounds, color] = await Promise.all([
		helper.getNumber(element.opacity, 100),
		convertDrawBounds(helper, element),
		helper.getNumber(element.color, 0),
	])

	return {
		id: element.id,
		type: 'box',
		enabled,
		opacity,
		...bounds,
		color,
	}
}

async function convertDrawBounds(
	helper: ExpressionHelper,
	element: MakeExpressionable<ButtonGraphicsDrawBounds & { type: string }>
): Promise<ButtonGraphicsDrawBounds> {
	const [x, y, width, height] = await Promise.all([
		helper.getNumber(element.x, 0),
		helper.getNumber(element.y, 0),
		helper.getNumber(element.width, 1),
		helper.getNumber(element.height, 1),
	])

	return { x, y, width, height }
}
