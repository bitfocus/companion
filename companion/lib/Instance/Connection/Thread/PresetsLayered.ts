import { nanoid } from 'nanoid'
import { FONTSIZE_SHRINK_DEFAULT } from '@companion-app/shared/Graphics/ElementPropertiesSchemas.js'
import {
	EntityModelType,
	type FeedbackEntityModel,
	type FeedbackEntityStyleOverride,
} from '@companion-app/shared/Model/EntityModel.js'
import {
	exprVal,
	isExpressionOrValue,
	optionsObjectToExpressionOptions,
	type ExpressionOrValue,
} from '@companion-app/shared/Model/Options.js'
import type {
	ButtonGraphicsBounds,
	ButtonGraphicsBoxElement,
	ButtonGraphicsCanvasElement,
	ButtonGraphicsCircleElement,
	ButtonGraphicsCompositeElement,
	ButtonGraphicsElementBase,
	ButtonGraphicsGaugeElement,
	ButtonGraphicsGroupElement,
	ButtonGraphicsImageElement,
	ButtonGraphicsLineElement,
	ButtonGraphicsTextElement,
	SomeButtonGraphicsElement,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import {
	ButtonGraphicsDecorationType,
	ButtonGraphicsElementUsage,
	ButtonGraphicsShowStatusIcons,
	type CompositeElementOptionKey,
} from '@companion-app/shared/Model/StyleModel.js'
import { assertNever } from '@companion-app/shared/Util.js'
import type {
	ButtonGraphicsCanvasElement as ButtonGraphicsCanvasElementModule,
	ButtonGraphicsDrawBounds as ButtonGraphicsDrawBoundsModule,
	ButtonGraphicsElementBase as ButtonGraphicsElementBaseModule,
	CompanionGraphicsElementValue,
	JsonValue,
	ModuleLogger,
	SomeButtonGraphicsElement as SomeButtonGraphicsElementModule,
	SomePresetLayeredFeedbackEntry,
} from '@companion-module/host'
import {
	isInternalPresetEntryId,
	tryConvertInternalLayeredFeedbackEntry,
	type PresetEntryConversionContext,
} from './PresetInternalEntities.js'

export function ConvertLayeredPresetFeedbacksToEntities(
	rawFeedbacks: SomePresetLayeredFeedbackEntry[] | undefined,
	ctx: PresetEntryConversionContext
): FeedbackEntityModel[] {
	if (!rawFeedbacks) return []

	const feedbacks: FeedbackEntityModel[] = []

	for (const feedback of rawFeedbacks) {
		const styleOverrides: FeedbackEntityStyleOverride[] = (feedback.styleOverrides ?? [])
			.filter((override) => isExpressionOrValue(override.override))
			.map((override) => ({
				overrideId: nanoid(),
				elementId: override.elementId,
				elementProperty: override.elementProperty,
				override: convertModuleExpressionOrValue(override.override, { isExpression: false, value: undefined }),
			}))
		if (styleOverrides.length === 0) continue

		if (ctx.allowInternalEntities && isInternalPresetEntryId(feedback.feedbackId)) {
			const entity = tryConvertInternalLayeredFeedbackEntry(feedback, styleOverrides, ctx)
			if (entity) feedbacks.push(entity)
		} else {
			feedbacks.push({
				type: EntityModelType.Feedback,
				id: nanoid(),
				connectionId: ctx.connectionId,
				definitionId: feedback.feedbackId,
				options: structuredClone(optionsObjectToExpressionOptions(feedback.options ?? {}, true)),
				isInverted: exprVal(!!feedback.isInverted),
				styleOverrides: structuredClone(styleOverrides),
				headline: feedback.headline,
				upgradeIndex: ctx.connectionUpgradeIndex,
			})
		}
	}

	return feedbacks
}

export function ConvertLayerPresetElements(
	logger: ModuleLogger,
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
		showStatusIcons: { isExpression: false, value: ButtonGraphicsShowStatusIcons.FollowDefault }, // Future: expose
	}

	return [
		canvasElement,
		...elements
			.map((el) => convertLayeredPresetElement(logger, connectionId, el, forceNewIds))
			.filter((el): el is SomeButtonGraphicsElement => el !== null),
	]
}

function convertLayeredPresetElement(
	logger: ModuleLogger,
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
				rotation: convertModuleExpressionOrValue(element.rotation, { value: 0, isExpression: false }),
				squareCoords: convertModuleExpressionOrValue(element.squareCoords, { value: false, isExpression: false }),

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
				fillMode: convertModuleExpressionOrValue(element.fillMode, { value: 'fit', isExpression: false }),
			} satisfies ButtonGraphicsImageElement
		case 'text':
			return {
				type: 'text',
				...convertElementBasicProperties(element, 'Text', forceNewIds),

				...convertElementSize(element),
				rotation: convertModuleExpressionOrValue(element.rotation, { value: 0, isExpression: false }),

				text: convertModuleExpressionOrValue(element.text, { value: '', isExpression: false }),
				fontsize: convertModuleExpressionOrValue(element.fontsize, {
					value: FONTSIZE_SHRINK_DEFAULT,
					isExpression: false,
				}),
				fontsizeAllowShrink: convertModuleExpressionOrValue(element.fontsizeAllowShrink, {
					value: true,
					isExpression: false,
				}),
				font: convertModuleExpressionOrValue(element.font, { value: 'companion-sans', isExpression: false }),
				weight: { value: 'normal', isExpression: false },
				styles: { value: [], isExpression: false },
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
			const options: Record<CompositeElementOptionKey, ExpressionOrValue<JsonValue | undefined>> = {}
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
		case 'gauge': {
			const convertedStops = (element.stops ?? []).map((stop) => ({
				_id: { isExpression: false, value: nanoid() } as const,
				value: convertModuleExpressionOrValue(stop.value, { value: 0, isExpression: false }),
				color: convertModuleExpressionOrValue(stop.color, { value: 0x00ff00, isExpression: false }),
				gradient: convertModuleExpressionOrValue(stop.gradient, { value: false, isExpression: false }),
			}))
			// The gauge requires at least one colour stop; fall back to a sensible default when none are provided.
			if (convertedStops.length === 0) {
				convertedStops.push({
					_id: { isExpression: false, value: nanoid() } as const,
					value: { value: 0, isExpression: false },
					color: { value: 0x00ff00, isExpression: false },
					gradient: { value: false, isExpression: false },
				})
			}

			return {
				type: 'gauge',
				...convertElementBasicProperties(element, 'Gauge', forceNewIds),

				...convertElementSize(element),
				rotation: convertModuleExpressionOrValue(element.rotation, { value: 0, isExpression: false }),

				value: convertModuleExpressionOrValue(element.value, { value: 0, isExpression: false }),
				min: convertModuleExpressionOrValue(element.min, { value: 0, isExpression: false }),
				max: convertModuleExpressionOrValue(element.max, { value: 100, isExpression: false }),
				origin: convertModuleExpressionOrValue(element.origin, { value: 0, isExpression: false }),
				symmetric: convertModuleExpressionOrValue(element.symmetric, { value: false, isExpression: false }),
				orientation: convertModuleExpressionOrValue(element.orientation, { value: 'horizontal', isExpression: false }),
				reverse: convertModuleExpressionOrValue(element.reverse, { value: false, isExpression: false }),
				startAngle: convertModuleExpressionOrValue(element.startAngle, { value: 0, isExpression: false }),
				endAngle: convertModuleExpressionOrValue(element.endAngle, { value: 360, isExpression: false }),
				ringWidth: convertModuleExpressionOrValue(element.ringWidth, { value: 20, isExpression: false }),
				roundedEnds: convertModuleExpressionOrValue(element.roundedEnds, { value: true, isExpression: false }),
				fillEnabled: convertModuleExpressionOrValue(element.fillEnabled, { value: true, isExpression: false }),
				multiColour: convertModuleExpressionOrValue(element.multiColour, { value: true, isExpression: false }),
				stops: { isExpression: false, value: convertedStops },
				markerEnabled: convertModuleExpressionOrValue(element.markerEnabled, { value: false, isExpression: false }),
				markerColor: convertModuleExpressionOrValue(element.markerColor, { value: 0xffffff, isExpression: false }),
				markerWidth: convertModuleExpressionOrValue(element.markerWidth, { value: 15, isExpression: false }),
				trackStyle: convertModuleExpressionOrValue(element.trackStyle, { value: 'transparent', isExpression: false }),
				trackAmount: convertModuleExpressionOrValue(element.trackAmount, { value: 70, isExpression: false }),
				trackWidth: convertModuleExpressionOrValue(element.trackWidth, { value: 100, isExpression: false }),
			} satisfies ButtonGraphicsGaugeElement
		}
		default:
			assertNever(element)
			logger.info(`Unsupported element type in layered preset: ${elementType}`)
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
	value: CompanionGraphicsElementValue<T> | undefined,
	defaultValue: ExpressionOrValue<T>
): ExpressionOrValue<T> {
	if (value === undefined) return defaultValue
	if (!isExpressionOrValue(value)) return { isExpression: false, value: value }

	if (value.isExpression) {
		return { value: value.value, isExpression: true }
	} else {
		return { value: value.value, isExpression: false }
	}
}
