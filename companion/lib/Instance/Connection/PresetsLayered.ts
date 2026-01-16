import { nanoid } from 'nanoid'
import type {
	CompanionPresetLayeredFeedback,
	ButtonGraphicsCanvasElement as ButtonGraphicsCanvasElementModule,
	SomeButtonGraphicsElement as SomeButtonGraphicsElementModule,
	ExpressionOrValue as ExpressionOrValueModule,
	ButtonGraphicsDrawBounds as ButtonGraphicsDrawBoundsModule,
	ButtonGraphicsElementBase as ButtonGraphicsElementBaseModule,
} from '@companion-module/base'
import {
	ButtonGraphicsDecorationType,
	ButtonGraphicsElementUsage,
	type CompositeElementOptionKey,
} from '@companion-app/shared/Model/StyleModel.js'
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
	ButtonGraphicsCircleElement,
	ButtonGraphicsCompositeElement,
} from '@companion-app/shared/Model/StyleLayersModel.js'

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
	connectionId: string,
	canvas: ButtonGraphicsCanvasElementModule | undefined,
	elements: SomeButtonGraphicsElementModule[],
	forceNewIds = false
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
			.map((el) => convertLayeredPresetElement(logger, connectionId, el, forceNewIds))
			.filter((el): el is SomeButtonGraphicsElement => el !== null),
	]
}

function convertLayeredPresetElement(
	logger: Logger,
	connectionId: string,
	element: SomeButtonGraphicsElementModule,
	forceNewIds: boolean
): SomeButtonGraphicsElement | null {
	const elementType = element.type
	switch (element.type) {
		case 'box':
			return {
				type: 'box',
				...convertElementBasicProperties(element, 'Box', forceNewIds),

				...convertElementSize(element),
				rotation: convertModuleExpressionOrValue(element.rotation, { value: 0, isExpression: false }),

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
				...convertElementBasicProperties(element, 'Group', forceNewIds),

				...convertElementSize(element),
				rotation: { value: 0, isExpression: false }, // TODO - presets

				children: element.children
					.map((child) => convertLayeredPresetElement(logger, connectionId, child, forceNewIds))
					.filter((el): el is SomeButtonGraphicsElement => el !== null),
			} satisfies ButtonGraphicsGroupElement
		case 'image':
			return {
				type: 'image',
				...convertElementBasicProperties(element, 'Image', forceNewIds),

				...convertElementSize(element),
				rotation: convertModuleExpressionOrValue(element.rotation, { value: 0, isExpression: false }),

				base64Image: convertModuleExpressionOrValue(element.base64Image, { value: null, isExpression: false }),
				halign: convertModuleExpressionOrValue(element.halign, { value: 'center', isExpression: false }),
				valign: convertModuleExpressionOrValue(element.valign, { value: 'center', isExpression: false }),
				fillMode: convertModuleExpressionOrValue(element.fillMode, { value: 'fit_or_shrink', isExpression: false }),
			} satisfies ButtonGraphicsImageElement
		case 'text':
			return {
				type: 'text',
				...convertElementBasicProperties(element, 'Text', forceNewIds),

				...convertElementSize(element),
				rotation: convertModuleExpressionOrValue(element.rotation, { value: 0, isExpression: false }),

				text: convertModuleExpressionOrValue(element.text, { value: '', isExpression: false }),
				fontsize: convertModuleExpressionOrValue(element.fontsize as ExpressionOrValueModule<string>, {
					value: 'auto',
					isExpression: false,
				}),
				color: convertModuleExpressionOrValue(element.color, { value: 0xffffff, isExpression: false }),
				halign: convertModuleExpressionOrValue(element.halign, { value: 'center', isExpression: false }),
				valign: convertModuleExpressionOrValue(element.valign, { value: 'center', isExpression: false }),

				outlineColor: convertModuleExpressionOrValue(element.outlineColor, { value: 0xff000000, isExpression: false }),
			} satisfies ButtonGraphicsTextElement
		case 'line':
			return {
				type: 'line',
				...convertElementBasicProperties(element, 'Line', forceNewIds),

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
		case 'circle':
			return {
				type: 'circle',
				...convertElementBasicProperties(element, 'Circle', forceNewIds),

				...convertElementSize(element),

				color: convertModuleExpressionOrValue(element.color, { value: 0xffffff, isExpression: false }),

				startAngle: convertModuleExpressionOrValue(element.startAngle, { value: 0, isExpression: false }),
				endAngle: convertModuleExpressionOrValue(element.endAngle, { value: 360, isExpression: false }),
				drawSlice: convertModuleExpressionOrValue(element.drawSlice, { value: false, isExpression: false }),

				borderColor: convertModuleExpressionOrValue(element.borderColor, { value: 0x000000, isExpression: false }),
				borderWidth: convertModuleExpressionOrValue(element.borderWidth, { value: 0, isExpression: false }),
				borderPosition: convertModuleExpressionOrValue(element.borderPosition, {
					value: 'inside',
					isExpression: false,
				}),
				borderOnlyArc: convertModuleExpressionOrValue(element.borderOnlyArc, { value: false, isExpression: false }),
			} satisfies ButtonGraphicsCircleElement
		case 'composite': {
			const options: Record<CompositeElementOptionKey, ExpressionOrValue<any>> = {}
			for (const [key, value] of Object.entries(element.options || {})) {
				options[`opt:${key}`] = convertModuleExpressionOrValue(value, undefined as any) // Convert, and omit invalid values
			}

			return {
				type: 'composite',
				...convertElementBasicProperties(element, 'Composite', forceNewIds),

				...convertElementSize(element),

				connectionId,
				elementId: element.elementId,

				...options,
			} satisfies ButtonGraphicsCompositeElement
		}
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
	defaultName: string,
	forceNewIds: boolean
): ButtonGraphicsElementBase {
	return {
		id: forceNewIds ? nanoid() : element.id || nanoid(),
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
