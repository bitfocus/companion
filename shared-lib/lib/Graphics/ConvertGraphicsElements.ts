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
} from '../Model/StyleLayersModel.js'
import { ALIGNMENT_OPTIONS } from '../Model/Alignment.js'

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

	const newElements = await Promise.all(
		elements.map((element) => {
			switch (element.type) {
				case 'canvas':
					return convertCanvasElementForDrawing(helper, element)
				case 'image':
					return convertImageElementForDrawing(helper, element)
				case 'text':
					return convertTextElementForDrawing(helper, element)
				default:
					return null
			}
		})
	)

	return {
		elements: newElements.filter((element) => element !== null),
		usedVariables: helper.usedVariables,
	}
}

async function convertCanvasElementForDrawing(
	helper: ExpressionHelper,
	element: ButtonGraphicsCanvasElement
): Promise<ButtonGraphicsCanvasDrawElement> {
	const [color, decoration] = await Promise.all([
		helper.getNumber(element.color, 0),
		helper.getEnum(
			element.decoration,
			Object.values(ButtonGraphicsDecorationType),
			ButtonGraphicsDecorationType.FollowDefault
		),
	])

	return {
		id: element.id,
		type: 'canvas',
		color,
		decoration,
	}
}

async function convertImageElementForDrawing(
	helper: ExpressionHelper,
	element: ButtonGraphicsImageElement
): Promise<ButtonGraphicsImageDrawElement | null> {
	// Perform enabled check first, to avoid executing expressions when not needed
	const enabled = await helper.getBoolean(element.enabled, true)
	if (!enabled && helper.onlyEnabled) return null

	const [bounds, base64Image, alignment, fillMode] = await Promise.all([
		convertDrawBounds(helper, element),
		helper.getString<string | null>(element.base64Image, null),
		helper.getEnum(element.alignment, ALIGNMENT_OPTIONS, 'center:center'),
		helper.getEnum(element.fillMode, ['crop', 'fill', 'fit', 'fit_or_shrink'], 'fit_or_shrink'),
	])

	return {
		id: element.id,
		type: 'image',
		enabled,
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

	const [bounds, fontsizeRaw, text, color, alignment] = await Promise.all([
		convertDrawBounds(helper, element),
		helper.getUnknown(element.fontsize, 'auto'),
		helper.getUnknown(element.text, 'ERR'), // TODO-layered better default value
		helper.getNumber(element.color, 0),
		helper.getEnum(element.alignment, ALIGNMENT_OPTIONS, 'center:center'),
	])

	const fontsize = Number(fontsizeRaw) || fontsizeRaw

	return {
		id: element.id,
		type: 'text',
		enabled,
		...bounds,
		text: text + '',
		fontsize: fontsize === 'auto' || typeof fontsize === 'number' ? fontsize : 'auto',
		color,
		alignment,
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
