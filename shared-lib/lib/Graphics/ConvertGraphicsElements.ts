import type { ExecuteExpressionResult } from '../Expression/ExpressionResult.js'
import {
	ButtonGraphicsDecorationType,
	ButtonGraphicsImageDrawElement,
	ButtonGraphicsImageElement,
	ButtonGraphicsTextDrawElement,
	ButtonGraphicsTextElement,
	type ButtonGraphicsCanvasDrawElement,
	type ButtonGraphicsCanvasElement,
	type ExpressionOrValue,
	type SomeButtonGraphicsDrawElement,
	type SomeButtonGraphicsElement,
} from '../Model/StyleLayersModel.js'
import { ALIGNMENT_OPTIONS } from '../Model/Alignment.js'

type ExecuteExpressionFn = (str: string, requiredType?: string) => ExecuteExpressionResult

class ExpressionHelper {
	readonly #executeExpression: ExecuteExpressionFn

	readonly usedVariables = new Set<string>()

	constructor(executeExpression: ExecuteExpressionFn) {
		this.#executeExpression = executeExpression
	}

	#executeExpressionAndTrackVariables(str: string, requiredType: string | undefined): ExecuteExpressionResult {
		const result = this.#executeExpression(str, requiredType)

		// Track the variables used in the expression, even when it failed
		for (const variable of result.variableIds) {
			this.usedVariables.add(variable)
		}

		return result
	}

	getUnknown(
		value: ExpressionOrValue<boolean | number | string | undefined>,
		defaultValue: boolean | number | string | undefined
	): boolean | number | string | undefined {
		if (!value.isExpression) return value.value

		const result = this.#executeExpressionAndTrackVariables(value.value, undefined)
		if (!result.ok) {
			return defaultValue
		}

		return result.value
	}

	getNumber(value: ExpressionOrValue<number>, defaultValue: number): number {
		if (!value.isExpression) return value.value

		const result = this.#executeExpressionAndTrackVariables(value.value, 'number')
		if (!result.ok) {
			return defaultValue
		}

		return result.value as number
	}

	getString<T extends string | null | undefined>(value: ExpressionOrValue<T>, defaultValue: T): T {
		if (!value.isExpression) return value.value

		const result = this.#executeExpressionAndTrackVariables(value.value, 'string')
		if (!result.ok) {
			return defaultValue
		}

		return result.value as T
	}

	getEnum<T extends string>(value: ExpressionOrValue<T>, values: T[], defaultValue: T): T {
		if (!value.isExpression) return value.value

		const result = this.#executeExpressionAndTrackVariables(value.value, 'string')
		if (!result.ok) {
			return defaultValue
		}

		const strValue = result.value as string
		if (!values.includes(strValue as T)) {
			return defaultValue
		}

		return strValue as T
	}
}

export function ConvertSomeButtonGraphicsElementForDrawing(
	elements: SomeButtonGraphicsElement[],
	executeExpression: ExecuteExpressionFn
): {
	elements: SomeButtonGraphicsDrawElement[]
	usedVariables: Set<string>
} {
	const helper = new ExpressionHelper(executeExpression)

	const newElements = elements
		.map((element) => {
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
		.filter((element) => element !== null)

	return {
		elements: newElements,
		usedVariables: helper.usedVariables,
	}
}

function convertCanvasElementForDrawing(
	helper: ExpressionHelper,
	element: ButtonGraphicsCanvasElement
): ButtonGraphicsCanvasDrawElement {
	return {
		type: 'canvas',
		color: helper.getNumber(element.color, 0),
		decoration: helper.getEnum(
			element.decoration,
			Object.values(ButtonGraphicsDecorationType),
			ButtonGraphicsDecorationType.FollowDefault
		),
	}
}

function convertImageElementForDrawing(
	helper: ExpressionHelper,
	element: ButtonGraphicsImageElement
): ButtonGraphicsImageDrawElement {
	return {
		type: 'image',
		base64Image: helper.getString<string | null>(element.base64Image, null),
		alignment: helper.getEnum(element.alignment, ALIGNMENT_OPTIONS, 'center:center'),
	}
}

function convertTextElementForDrawing(
	helper: ExpressionHelper,
	element: ButtonGraphicsTextElement
): ButtonGraphicsTextDrawElement {
	let fontsize = helper.getUnknown(element.fontsize, 'auto')
	fontsize = Number(fontsize) || fontsize

	return {
		type: 'text',
		text: helper.getUnknown(element.text, 'ERR') + '', // TODO-layered better default value
		fontsize: fontsize === 'auto' || typeof fontsize === 'number' ? fontsize : 'auto',
		color: helper.getNumber(element.color, 0),
		alignment: helper.getEnum(element.alignment, ALIGNMENT_OPTIONS, 'center:center'),
	}
}
