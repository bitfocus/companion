import { nanoid } from 'nanoid'
import {
	type CompanionPresetLayeredFeedback,
	type ButtonGraphicsCanvasElement as ButtonGraphicsCanvasElementModule,
	type SomeButtonGraphicsElement as SomeButtonGraphicsElementModule,
	type ExpressionOrValue as ExpressionOrValueModule,
	type ButtonGraphicsDrawBounds as ButtonGraphicsDrawBoundsModule,
	type ButtonGraphicsElementBase as ButtonGraphicsElementBaseModule,
	ButtonGraphicsDecorationType,
} from '@companion-module/base'
import { type Logger } from '../../Log/Controller.js'
import {
	EntityModelType,
	type FeedbackEntityModel,
	type FeedbackEntityStyleOverride,
} from '@companion-app/shared/Model/EntityModel.js'
import { assertNever } from '@companion-app/shared/Util.js'
import { type ExpressionOrValue, isExpressionOrValue } from '@companion-app/shared/Model/Expression.js'
import type {
	SomeButtonGraphicsElement,
	ButtonGraphicsCanvasElement,
	ButtonGraphicsBoxElement,
	ButtonGraphicsGroupElement,
	ButtonGraphicsImageElement,
	ButtonGraphicsTextElement,
	ButtonGraphicsLineElement,
	ButtonGraphicsBounds,
	ButtonGraphicsElementBase,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import { ButtonGraphicsElementUsage } from '@companion-app/shared/Model/StyleModel.js'

export function ConvertLayeredPresetFeedbacksToEntities(
	rawFeedbacks: CompanionPresetLayeredFeedback[] | undefined,
	connectionId: string,
	connectionUpgradeIndex: number | undefined
): FeedbackEntityModel[] {
	if (!rawFeedbacks) return []

	const feedbacks: FeedbackEntityModel[] = []

	for (const feedback of rawFeedbacks) {
		const styleOverrides: FeedbackEntityStyleOverride[] = feedback.styleOverrides
			.filter((override) => isExpressionOrValue(override.override))
			.map((override) => ({
				overrideId: nanoid(),
				elementId: override.elementId,
				elementProperty: override.elementProperty,
				override: override.override,
			}))
		if (styleOverrides.length === 0) continue

		feedbacks.push({
			type: EntityModelType.Feedback,
			id: nanoid(),
			connectionId: connectionId,
			definitionId: feedback.feedbackId,
			options: structuredClone(feedback.options ?? {}),
			isInverted: !!feedback.isInverted,
			styleOverrides: structuredClone(styleOverrides),
			headline: feedback.headline,
			upgradeIndex: connectionUpgradeIndex,
		})
	}

	return feedbacks
}

export function ConvertLayerPresetElements(
	logger: Logger,
	canvas: ButtonGraphicsCanvasElementModule | undefined,
	elements: SomeButtonGraphicsElementModule[]
): SomeButtonGraphicsElement[] {
	const canvasElement: ButtonGraphicsCanvasElement = {
		id: nanoid(),
		type: 'canvas',
		name: 'Canvas',
		usage: ButtonGraphicsElementUsage.Automatic,
		decoration: convertModuleExpressionOrValue(canvas?.decoration, {
			value: ButtonGraphicsDecorationType.FollowDefault,
			isExpression: false,
		}),
	}

	return [
		canvasElement,
		...elements
			.map((el) => convertLayeredPresetElement(logger, el))
			.filter((el): el is SomeButtonGraphicsElement => el !== null),
	]
}

function convertLayeredPresetElement(
	logger: Logger,
	element: SomeButtonGraphicsElementModule
): SomeButtonGraphicsElement | null {
	const elementType = element.type
	switch (element.type) {
		case 'box':
			return {
				type: 'box',
				...convertElementBasicProperties(element, 'Box'),

				...convertElementSize(element),

				color: convertModuleExpressionOrValue(element.color, { value: 0xffffff, isExpression: false }),

				borderColor: convertModuleExpressionOrValue(element.borderColor, { value: 0x000000, isExpression: false }),
				borderWidth: convertModuleExpressionOrValue(element.borderWidth, { value: 0, isExpression: false }),
				borderPosition: convertModuleExpressionOrValue(element.borderPosition, {
					value: 'inside',
					isExpression: false,
				}),
			} satisfies ButtonGraphicsBoxElement
		case 'group':
			return {
				type: 'group',
				...convertElementBasicProperties(element, 'Group'),

				...convertElementSize(element),

				children: element.children
					.map((child) => convertLayeredPresetElement(logger, child))
					.filter((el): el is SomeButtonGraphicsElement => el !== null),
			} satisfies ButtonGraphicsGroupElement
		case 'image':
			return {
				type: 'image',
				...convertElementBasicProperties(element, 'Image'),

				...convertElementSize(element),

				base64Image: convertModuleExpressionOrValue(element.base64Image, { value: null, isExpression: false }),
				halign: convertModuleExpressionOrValue(element.halign, { value: 'center', isExpression: false }),
				valign: convertModuleExpressionOrValue(element.valign, { value: 'center', isExpression: false }),
				fillMode: convertModuleExpressionOrValue(element.fillMode, { value: 'fit_or_shrink', isExpression: false }),
			} satisfies ButtonGraphicsImageElement
		case 'text':
			return {
				type: 'text',
				...convertElementBasicProperties(element, 'Text'),

				...convertElementSize(element),

				text: convertModuleExpressionOrValue(element.text, { value: '', isExpression: false }),
				fontsize: convertModuleExpressionOrValue(element.fontsize, {
					value: 'auto',
					isExpression: false,
				}) as ExpressionOrValue<string>,
				color: convertModuleExpressionOrValue(element.color, { value: 0xffffff, isExpression: false }),
				halign: convertModuleExpressionOrValue(element.halign, { value: 'center', isExpression: false }),
				valign: convertModuleExpressionOrValue(element.valign, { value: 'center', isExpression: false }),

				outlineColor: convertModuleExpressionOrValue(element.outlineColor, { value: 0xff000000, isExpression: false }),
			} satisfies ButtonGraphicsTextElement
		case 'line':
			return {
				type: 'line',
				...convertElementBasicProperties(element, 'Line'),

				fromX: convertModuleExpressionOrValue(element.fromX, { value: 0, isExpression: false }),
				fromY: convertModuleExpressionOrValue(element.fromY, { value: 0, isExpression: false }),
				toX: convertModuleExpressionOrValue(element.toX, { value: 100, isExpression: false }),
				toY: convertModuleExpressionOrValue(element.toY, { value: 100, isExpression: false }),

				borderColor: convertModuleExpressionOrValue(element.borderColor, { value: 0x000000, isExpression: false }),
				borderWidth: convertModuleExpressionOrValue(element.borderWidth, { value: 0, isExpression: false }),
				borderPosition: convertModuleExpressionOrValue(element.borderPosition, {
					value: 'inside',
					isExpression: false,
				}),
			} satisfies ButtonGraphicsLineElement
		default:
			assertNever(element)
			logger.info('Unsupported element type in layered-button preset:', elementType)
			return null
	}
}

function convertElementSize(element: ButtonGraphicsDrawBoundsModule): ButtonGraphicsBounds {
	return {
		x: convertModuleExpressionOrValue(element.x, { value: 0, isExpression: false }),
		y: convertModuleExpressionOrValue(element.y, { value: 0, isExpression: false }),
		width: convertModuleExpressionOrValue(element.width, { value: 100, isExpression: false }),
		height: convertModuleExpressionOrValue(element.height, { value: 100, isExpression: false }),
	}
}

function convertElementBasicProperties(
	element: ButtonGraphicsElementBaseModule,
	defaultName: string
): ButtonGraphicsElementBase {
	return {
		id: element.id || nanoid(),
		name: element.name ?? defaultName,
		usage: ButtonGraphicsElementUsage.Automatic,
		enabled: convertModuleExpressionOrValue(element.enabled, { value: true, isExpression: false }),
		opacity: convertModuleExpressionOrValue(element.opacity, { value: 1, isExpression: false }),
	}
}

function convertModuleExpressionOrValue<T>(
	value: ExpressionOrValueModule<T> | undefined,
	defaultValue: ExpressionOrValue<T>
): ExpressionOrValue<T> {
	if (!isExpressionOrValue(value)) return defaultValue

	if (value.isExpression) {
		return { value: value.value, isExpression: true }
	} else {
		return { value: value.value, isExpression: false }
	}
}
