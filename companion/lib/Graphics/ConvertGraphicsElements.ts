import { createHash } from 'node:crypto'
import type { JsonValue } from 'type-fest'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import {
	FONTSIZE_SHRINK_DEFAULT,
	getElementSchemaProperty,
} from '@companion-app/shared/Graphics/ElementPropertiesSchemas.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import type {
	ButtonGraphicsBorder,
	ButtonGraphicsBounds,
	ButtonGraphicsBoxDrawElement,
	ButtonGraphicsBoxElement,
	ButtonGraphicsCanvasDrawElement,
	ButtonGraphicsCanvasElement,
	ButtonGraphicsCircleDrawElement,
	ButtonGraphicsCircleElement,
	ButtonGraphicsCompositeElement,
	ButtonGraphicsDrawBorder,
	ButtonGraphicsDrawBounds,
	ButtonGraphicsElementBase,
	ButtonGraphicsGaugeDrawElement,
	ButtonGraphicsGaugeElement,
	ButtonGraphicsGroupDrawElement,
	ButtonGraphicsGroupElement,
	ButtonGraphicsImageDrawElement,
	ButtonGraphicsImageElement,
	ButtonGraphicsLineDrawElement,
	ButtonGraphicsLineElement,
	ButtonGraphicsReferenceDrawElement,
	ButtonGraphicsReferenceElement,
	ButtonGraphicsTextDrawElement,
	ButtonGraphicsTextElement,
	SomeButtonGraphicsDrawElement,
	SomeButtonGraphicsElement,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import {
	ButtonGraphicsDecorationType,
	ButtonGraphicsElementUsage,
	ButtonGraphicsShowStatusIcons,
	type CompositeElementOptionKey,
	type DrawImageBuffer,
} from '@companion-app/shared/Model/StyleModel.js'
import {
	stringifyVariableValue,
	type VariableValue,
	type VariableValues,
} from '@companion-app/shared/Model/Variables.js'
import { assertNever } from '@companion-app/shared/Util.js'
import type {
	CompositeElementDefinition,
	CompositeElementIdString,
	InstanceDefinitions,
} from '../Instance/Definitions.js'
import { ParseLocationString } from '../Internal/Util.js'
import type { VariablesAndExpressionParser } from '../Variables/VariablesAndExpressionParser.js'
import {
	createParseElementsContext,
	type DrawPixelBuffers,
	type ElementExpressionHelper,
	type ExpressionReferences,
	type ParseElementsContext,
} from './ConvertGraphicsElements/Helper.js'
import { collectContentHashes, computeElementContentHash } from './ConvertGraphicsElements/Util.js'
import type { ElementConversionCache, ElementConversionCacheEntry } from './ElementConversionCache.js'
import type { ImageResult } from './ImageResult.js'

/** Extract the valid choice IDs for a dropdown field directly from the element schema. */
function dropdownChoices<T extends string>(
	elementType: Parameters<typeof getElementSchemaProperty>[0],
	fieldId: string
): T[] {
	const field = getElementSchemaProperty(elementType, fieldId)
	if (field?.type !== 'dropdown') return []
	return field.choices.map((c) => String(c.id)) as T[]
}

// All derived once at module load to avoid repeated schema lookups on every render.
const CANVAS_DECORATION_CHOICES = dropdownChoices<ButtonGraphicsDecorationType>('canvas', 'decoration')
const CANVAS_SHOW_STATUS_ICONS_CHOICES = dropdownChoices<ButtonGraphicsShowStatusIcons>('canvas', 'showStatusIcons')
const IMAGE_FILL_MODE_CHOICES = dropdownChoices<ButtonGraphicsImageDrawElement['fillMode']>('image', 'fillMode')
const TEXT_FONT_CHOICES = dropdownChoices<ButtonGraphicsTextDrawElement['font']>('text', 'font')
const TEXT_WEIGHT_CHOICES = dropdownChoices<ButtonGraphicsTextDrawElement['weight']>('text', 'weight')
// The `styles` field is an internal:text-styles multi-toggle with a fixed set of values (no schema choices).
const TEXT_STYLE_VALUES = ['italic', 'underline', 'strikethrough'] as const
// borderPosition is shared across box/line/circle — all use the same choices from borderFields.
const BORDER_POSITION_CHOICES = dropdownChoices<ButtonGraphicsDrawBorder['borderPosition']>('box', 'borderPosition')
const GAUGE_ORIENTATION_CHOICES = dropdownChoices<ButtonGraphicsGaugeDrawElement['orientation']>('gauge', 'orientation')
const GAUGE_TRACK_STYLE_CHOICES = dropdownChoices<ButtonGraphicsGaugeDrawElement['trackStyle']>('gauge', 'trackStyle')

export async function ConvertSomeButtonGraphicsElementForDrawing(
	compositeElementStore: InstanceDefinitions,
	parser: VariablesAndExpressionParser,
	drawPixelBuffers: DrawPixelBuffers,
	elements: SomeButtonGraphicsElement[],
	feedbackOverrides: ReadonlyMap<string, ReadonlyMap<string, ExpressionOrValue<JsonValue | undefined>>>,
	onlyEnabled: boolean,
	cache: ElementConversionCache | null,
	currentLocationStr: string | null = null,
	getRenderAtLocation: ((location: ControlLocation) => ImageResult | null) | null = null
): Promise<{
	elements: SomeButtonGraphicsDrawElement[]
	usedVariables: Set<string>
	usedCompositeElements: Set<CompositeElementIdString>
	referencedLocations: Set<string>
	cyclicLocations: Set<string>
}> {
	// Apply any queued invalidations before processing
	cache?.applyQueuedInvalidations()

	const globalReferences: ExpressionReferences = {
		variables: new Set(),
		compositeElements: new Set(),
		referencedLocations: new Set(),
		cyclicLocations: new Set(),
	}

	// Track all processed element IDs (with prefixes) for cache purging
	const processedElementIds = new Set<string>()

	const context = createParseElementsContext(
		compositeElementStore,
		parser,
		drawPixelBuffers,
		feedbackOverrides,
		onlyEnabled,
		cache,
		globalReferences,
		processedElementIds,
		currentLocationStr,
		getRenderAtLocation
	)

	const newElements = await convertElements(context, elements, '')

	// Purge cache entries for elements no longer in the tree
	// Uses processedElementIds which contains the actual prefixed IDs we processed
	cache?.purgeUnusedElements(processedElementIds)

	return {
		elements: newElements,
		usedVariables: globalReferences.variables,
		usedCompositeElements: globalReferences.compositeElements,
		referencedLocations: globalReferences.referencedLocations,
		cyclicLocations: globalReferences.cyclicLocations,
	}
}

async function convertElements(
	context: ParseElementsContext,
	elements: SomeButtonGraphicsElement[],
	idPrefix: string
): Promise<SomeButtonGraphicsDrawElement[]> {
	const newElements = await Promise.all(
		elements.map(async (element): Promise<SomeButtonGraphicsDrawElement | null> => {
			const elementId = idPrefix + element.id

			// Track that we're processing this element (for cache purging)
			context.processedElementIds.add(elementId)

			let cacheEntry = context.cache?.get(elementId)
			if (!cacheEntry) {
				// No cache entry, compute from scratch

				switch (element.type) {
					case 'canvas': {
						cacheEntry = convertCanvasElementForDrawing(context, element, idPrefix)
						break
					}
					case 'group': {
						cacheEntry = convertGroupElementForDrawing(context, element, idPrefix)
						break
					}
					case 'image': {
						cacheEntry = await convertImageElementForDrawing(context, element, idPrefix)
						break
					}
					case 'text': {
						cacheEntry = convertTextElementForDrawing(context, element, idPrefix)
						break
					}
					case 'box': {
						cacheEntry = convertBoxElementForDrawing(context, element, idPrefix)
						break
					}
					case 'line': {
						cacheEntry = convertLineElementForDrawing(context, element, idPrefix)
						break
					}
					case 'circle': {
						cacheEntry = convertCircleElementForDrawing(context, element, idPrefix)
						break
					}
					case 'gauge': {
						cacheEntry = convertGaugeElementForDrawing(context, element, idPrefix)
						break
					}
					case 'composite': {
						cacheEntry = await convertCompositeElementForDrawing(context, element, idPrefix)
						break
					}
					case 'reference': {
						cacheEntry = await convertReferenceElementForDrawing(context, element, idPrefix)
						break
					}
					default:
						assertNever(element)
						return null
				}

				// Cache the result for cacheable element types (not groups/composites as they have children cached separately)
				if (context.cache) {
					context.cache.set(elementId, cacheEntry)
				}
			}

			// Merge element's references into global references
			for (const variable of cacheEntry.usedVariables) {
				context.globalReferences.variables.add(variable)
			}
			if (cacheEntry.compositeElement?.elementId)
				context.globalReferences.compositeElements.add(cacheEntry.compositeElement.elementId)
			if (cacheEntry.referencedLocation) context.globalReferences.referencedLocations.add(cacheEntry.referencedLocation)

			// If this is a group, populate the children
			if (element.type === 'group' || element.type === 'composite') {
				const childIdPrefix = cacheEntry.compositeElement ? cacheEntry.compositeElement.childIdPrefix : idPrefix

				const children =
					element.type === 'group'
						? element.children
						: (context.resolveCompositeElement(element.connectionId, element.elementId)?.elements ?? [])

				if (cacheEntry.drawElement?.type === 'group') {
					const childContext = cacheEntry.compositeElement?.childPropOverrides
						? context.withPropOverrides(cacheEntry.compositeElement.childPropOverrides)
						: context

					// Recurse to process children
					return {
						...cacheEntry.drawElement,
						children: await convertElements(childContext, children, childIdPrefix),
					}
				} else {
					// Element is disabled but we still need to track child IDs so they aren't purged from cache
					// This allows re-enabling the element to reuse cached children without recomputation
					collectChildElementIds(context, children, childIdPrefix)

					return cacheEntry.drawElement
				}
			} else {
				// No children to process, return cached entry directly
				return cacheEntry.drawElement
			}
		})
	)

	return newElements.filter((el): el is SomeButtonGraphicsDrawElement => el !== null)
}

function convertCanvasElementForDrawing(
	context: ParseElementsContext,
	element: ButtonGraphicsCanvasElement,
	idPrefix: string
): ElementConversionCacheEntry {
	const { helper, usedVariables } = context.createHelper(element)

	const drawElement: ButtonGraphicsCanvasDrawElement = {
		id: idPrefix + element.id,
		type: 'canvas',
		usage: element.usage,
		// color,
		decoration: helper.getEnum('decoration', CANVAS_DECORATION_CHOICES, ButtonGraphicsDecorationType.FollowDefault),
		showStatusIcons: helper.getEnum(
			'showStatusIcons',
			CANVAS_SHOW_STATUS_ICONS_CHOICES,
			ButtonGraphicsShowStatusIcons.FollowDefault
		),
		contentHash: '', // Will be computed below
	}

	drawElement.contentHash = computeElementContentHash(drawElement)
	return { drawElement, usedVariables, compositeElement: null }
}

/**
 * Convert group element using the context for recursive child conversion
 */
function convertGroupElementForDrawing(
	context: ParseElementsContext,
	element: ButtonGraphicsGroupElement,
	idPrefix: string
): ElementConversionCacheEntry {
	const { helper, usedVariables } = context.createHelper(element)

	// Perform enabled check first, to avoid executing expressions when not needed
	const enabled = helper.getBoolean('enabled', true)
	if (!enabled && context.onlyEnabled) return { drawElement: null, usedVariables, compositeElement: null }

	// Note: Group hash is shallow - children have their own hashes
	const drawElement: ButtonGraphicsGroupDrawElement = {
		id: idPrefix + element.id,
		type: 'group',
		usage: element.usage,
		enabled,
		opacity: helper.getNumber('opacity', 1, 0.01),
		...convertDrawBounds(helper),
		rotation: helper.getNumber('rotation', 0),
		squareCoords: helper.getBoolean('squareCoords', false),
		children: [], // Will be filled in by caller
		contentHash: '', // Will be computed below
	}

	drawElement.contentHash = computeElementContentHash(drawElement)
	return { drawElement, usedVariables, compositeElement: null }
}

/**
 * Convert reference element for drawing.
 * Evaluates the location expression and, if a render cache callback is provided,
 * resolves the referenced button's draw elements inline.
 */
async function convertReferenceElementForDrawing(
	context: ParseElementsContext,
	element: ButtonGraphicsReferenceElement,
	idPrefix: string
): Promise<ElementConversionCacheEntry> {
	const { helper, usedVariables } = context.createHelper(element)

	// Perform enabled check first, to avoid executing expressions when not needed
	const enabled = helper.getBoolean('enabled', true)
	if (!enabled && context.onlyEnabled) {
		return { drawElement: null, usedVariables, compositeElement: null }
	}

	const opacity = helper.getNumber('opacity', 1, 0.01)
	const drawBounds = convertDrawBounds(helper)
	const rotation = helper.getNumber('rotation', 0)

	const locationStr = helper.getParsedString('location', '')

	const drawElement: ButtonGraphicsReferenceDrawElement = {
		id: idPrefix + element.id,
		type: 'reference',
		usage: element.usage,
		enabled,
		opacity,
		...drawBounds,
		rotation,
		children: [],
		contentHash: '',
	}

	drawElement.contentHash = computeElementContentHash(drawElement)

	// Inline reference resolution using the provided render cache callback
	let referencedLocationStr: string | null = null
	if (locationStr) {
		if (!context.getRenderAtLocation) {
			// References are disabled (no render callback) — show a placeholder
			drawElement.children = makeReferencePlaceholder(drawElement.id, 'Unresolved\nReference')
		} else {
			const currentLocation = ParseLocationString(context.currentLocationStr, undefined)
			const targetLocation = ParseLocationString(locationStr, currentLocation ?? undefined)

			if (targetLocation) {
				const targetLocationStr = formatLocation(targetLocation)
				referencedLocationStr = targetLocationStr

				const targetRender = context.getRenderAtLocation(targetLocation)

				// Always track the direct dependency so we re-render when the target eventually renders
				context.globalReferences.referencedLocations.add(targetLocationStr)

				// Loop detection: check if the target's render transitively references this button
				const isLoop =
					targetLocationStr === context.currentLocationStr ||
					(context.currentLocationStr !== null &&
						targetRender?.referencedLocations.has(context.currentLocationStr) === true)

				if (isLoop) {
					// Circular reference detected — show a placeholder instead of recursing infinitely
					context.globalReferences.cyclicLocations.add(targetLocationStr)
					drawElement.children = makeReferencePlaceholder(drawElement.id, '\u221e')
				} else if (targetRender?.drawElements) {
					// Embed the referenced button's draw elements (exclude canvas elements which are render-specific)
					drawElement.children = targetRender.drawElements.filter((el) => el.type !== 'canvas')

					// Track transitive referenced locations for loop detection in parent renders
					for (const loc of targetRender.referencedLocations) {
						context.globalReferences.referencedLocations.add(loc)
					}
				}
			}
		}

		// Recompute contentHash to include children hashes so the LRU cache invalidates when referenced content changes
		const childHashes = collectContentHashes(drawElement.children).join(',')
		drawElement.contentHash = createHash('sha256')
			.update(drawElement.contentHash)
			.update(':')
			.update(childHashes)
			.digest('hex')
	}

	return { drawElement, usedVariables, compositeElement: null, referencedLocation: referencedLocationStr }
}

function makeReferencePlaceholder(
	parentId: string,
	text: string
): [ButtonGraphicsBoxDrawElement, ButtonGraphicsTextDrawElement] {
	const boxEl: ButtonGraphicsBoxDrawElement = {
		id: `${parentId}:placeholder-bg`,
		type: 'box',
		usage: ButtonGraphicsElementUsage.Automatic,
		enabled: true,
		opacity: 1,
		x: 0,
		y: 0,
		width: 1,
		height: 1,
		rotation: 0,
		color: 0xff8c00,
		cornerRadius: 0,
		borderWidth: 0,
		borderColor: 0,
		borderPosition: 'inside',
		contentHash: '',
	}
	boxEl.contentHash = computeElementContentHash(boxEl)

	const textEl: ButtonGraphicsTextDrawElement = {
		id: `${parentId}:placeholder-text`,
		type: 'text',
		usage: ButtonGraphicsElementUsage.Automatic,
		enabled: true,
		opacity: 1,
		x: 0,
		y: 0,
		width: 1,
		height: 1,
		rotation: 0,
		text,
		fontsize: FONTSIZE_SHRINK_DEFAULT,
		fontsizeAllowShrink: true,
		font: 'companion-sans',
		weight: 'normal',
		styles: [],
		color: 0xffffff,
		outlineColor: 0,
		halign: 'center',
		valign: 'center',
		contentHash: '',
	}
	textEl.contentHash = computeElementContentHash(textEl)

	return [boxEl, textEl]
}

function parseCompositeElementChildOptions(
	helper: ElementExpressionHelper<ButtonGraphicsCompositeElement>,
	elementDefinition: CompositeElementDefinition,
	element: ButtonGraphicsCompositeElement
): VariableValues {
	// Inject new values
	const propOverrides: VariableValues = {}

	for (const option of elementDefinition.options) {
		const optionKey: CompositeElementOptionKey = `opt:${option.id}`
		let overrideValue: VariableValue
		switch (option.type) {
			case 'checkbox':
				overrideValue = helper.getBoolean(optionKey, option.default)
				break

			case 'textinput': {
				const rawValue = element[optionKey]
				if (!rawValue) {
					overrideValue = option.default ?? ''
				} else if (rawValue.isExpression) {
					const res = helper.executeExpressionAndTrackVariables(rawValue.value, undefined)
					overrideValue = res.ok ? res.value : option.default
				} else if (option.useVariables) {
					overrideValue = helper.parseVariablesInString(
						stringifyVariableValue(rawValue.value) ?? '',
						option.default ?? ''
					)
				} else {
					overrideValue = stringifyVariableValue(rawValue.value) ?? ''
				}
				break
			}

			case 'expression': {
				const rawValue = element[optionKey]
				if (!rawValue) {
					overrideValue = option.default ?? ''
				} else {
					const res = helper.executeExpressionAndTrackVariables(stringifyVariableValue(rawValue.value) ?? '', undefined)
					overrideValue = res.ok ? res.value : option.default
				}
				break
			}

			case 'number':
				overrideValue = helper.getNumber(optionKey, option.default ?? 0, 1)
				break

			case 'dropdown':
				overrideValue = helper.getEnum(
					optionKey,
					option.choices.map((c) => c.id),
					option.default
				)
				break

			case 'colorpicker':
				if (option.returnType === 'string') {
					overrideValue = helper.getString(optionKey, String(option.default))
				} else {
					overrideValue = helper.getNumber(optionKey, Number(option.default) || 0, 1)
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
			case 'internal:image-file':
			case 'internal:surface_serial':
			case 'internal:outbound_surface_id':
			case 'internal:vertical-alignment':
			case 'internal:text-styles':
			case 'internal:trigger':
			case 'internal:trigger_collection':
			case 'internal:variable':
			case 'internal:variable_value':
			case 'internal:list':
			case 'internal:table':
			case 'secret-text':
			case 'static-text':
			case 'custom-variable':
			case 'bonjour-device':
				// Not supported
				continue
			default:
				assertNever(option)
				// Ignore unknown type
				continue
		}

		propOverrides[`options:${option.id}`] = overrideValue
	}

	return propOverrides
}

/**
 * Convert composite element using the factory for recursive child conversion
 */
async function convertCompositeElementForDrawing(
	context: ParseElementsContext,
	element: ButtonGraphicsCompositeElement,
	idPrefix: string
): Promise<ElementConversionCacheEntry> {
	const { helper, usedVariables } = context.createHelper(element)

	const compositeElementId: CompositeElementIdString = `${element.connectionId}:${element.elementId}`

	// The full ID of this composite element (with any parent prefixes)
	const compositeFullId = idPrefix + element.id

	const childElement = context.resolveCompositeElement(element.connectionId, element.elementId)
	if (!childElement) {
		return {
			drawElement: null,
			usedVariables,
			compositeElement: {
				elementId: compositeElementId,
				childIdPrefix: compositeFullId + '/',
				childPropOverrides: {},
			},
		}
	}

	const propOverrides = parseCompositeElementChildOptions(helper, childElement, element)
	const propOverridesHash = createHash('sha256').update(JSON.stringify(propOverrides)).digest('hex')

	const childIdPrefix = compositeFullId + '-' + propOverridesHash + '/'

	// Perform enabled check first, to avoid executing expressions when not needed
	const enabled = helper.getBoolean('enabled', true)
	if (!enabled && context.onlyEnabled)
		return {
			drawElement: null,
			usedVariables,
			compositeElement: {
				elementId: compositeElementId,
				childIdPrefix,
				childPropOverrides: propOverrides,
			},
		}

	const opacity = helper.getNumber('opacity', 1, 0.01)
	const bounds = convertDrawBounds(helper)

	// Note: Composite elements render as groups - hash is shallow (children have their own hashes)
	const drawElement: ButtonGraphicsGroupDrawElement = {
		id: compositeFullId,
		type: 'group',
		usage: element.usage,
		enabled,
		opacity,
		...bounds,
		rotation: 0, // Not supported on composite elements
		squareCoords: false,
		children: [], // Will be filled in by caller
		contentHash: '', // Will be computed below
	}

	drawElement.contentHash = computeElementContentHash(drawElement)
	return {
		drawElement,
		usedVariables,
		compositeElement: {
			elementId: compositeElementId,
			childIdPrefix,
			childPropOverrides: propOverrides,
		},
	}
}

async function convertImageElementForDrawing(
	context: ParseElementsContext,
	element: ButtonGraphicsImageElement,
	idPrefix: string
): Promise<ElementConversionCacheEntry> {
	const { helper, usedVariables } = context.createHelper(element)

	// Perform enabled check first, to avoid executing expressions when not needed
	const enabled = helper.getBoolean('enabled', true)
	if (!enabled && context.onlyEnabled) return { drawElement: null, usedVariables, compositeElement: null }

	// Hack: composite deprecated imageBuffers into a single base64 image
	let base64Image: string | null = null
	const base64ImageRaw = helper.getUnknown('base64Image', null)
	if (base64ImageRaw) {
		const imageObjs = base64ImageRaw as unknown as DrawImageBuffer[]
		if (Array.isArray(imageObjs)) {
			// This is not very efficient, as it is not cached, but as this is a deprecated feature, it is acceptable for now
			base64Image = (await context.drawPixelBuffers(imageObjs)) || null
		} else {
			// This could be a reference to the image library
			base64Image = helper.parseVariablesInString(stringifyVariableValue(base64ImageRaw) ?? '', 'ERR')
		}
	}

	const drawElement: ButtonGraphicsImageDrawElement = {
		id: idPrefix + element.id,
		type: 'image',
		usage: element.usage,
		enabled,
		opacity: helper.getNumber('opacity', 1, 0.01),
		...convertDrawBounds(helper),
		rotation: helper.getNumber('rotation', 0),
		base64Image: base64Image,
		halign: helper.getHorizontalAlignment('halign'),
		valign: helper.getVerticalAlignment('valign'),
		fillMode: helper.getEnum('fillMode', IMAGE_FILL_MODE_CHOICES, 'fit'),
		contentHash: '', // Will be computed below
	}

	drawElement.contentHash = computeElementContentHash(drawElement)
	return { drawElement, usedVariables, compositeElement: null }
}

function convertTextElementForDrawing(
	context: ParseElementsContext,
	element: ButtonGraphicsTextElement,
	idPrefix: string
): ElementConversionCacheEntry {
	const { helper, usedVariables } = context.createHelper(element)

	// Perform enabled check first, to avoid executing expressions when not needed
	const enabled = helper.getBoolean('enabled', true)
	if (!enabled && context.onlyEnabled) return { drawElement: null, usedVariables, compositeElement: null }

	const drawElement: ButtonGraphicsTextDrawElement = {
		id: idPrefix + element.id,
		type: 'text',
		usage: element.usage,
		enabled,
		opacity: helper.getNumber('opacity', 1, 0.01),
		...convertDrawBounds(helper),
		rotation: helper.getNumber('rotation', 0),
		text: helper.getParsedString('text', 'ERR') + '',
		fontsize: helper.getNumber('fontsize', FONTSIZE_SHRINK_DEFAULT),
		fontsizeAllowShrink: helper.getBoolean('fontsizeAllowShrink', false),
		font: helper.getEnum('font', TEXT_FONT_CHOICES, 'companion-sans'),
		weight: helper.getEnum('weight', TEXT_WEIGHT_CHOICES, 'normal'),
		styles: helper.getEnumArray('styles', TEXT_STYLE_VALUES, []),
		color: helper.getColor('color', 0),
		halign: helper.getHorizontalAlignment('halign'),
		valign: helper.getVerticalAlignment('valign'),
		outlineColor: helper.getColor('outlineColor', 0),
		contentHash: '', // Will be computed below
	}

	drawElement.contentHash = computeElementContentHash(drawElement)
	return { drawElement, usedVariables, compositeElement: null }
}

function convertBoxElementForDrawing(
	context: ParseElementsContext,
	element: ButtonGraphicsBoxElement,
	idPrefix: string
): ElementConversionCacheEntry {
	const { helper, usedVariables } = context.createHelper(element)

	// Perform enabled check first, to avoid executing expressions when not needed
	const enabled = helper.getBoolean('enabled', true)
	if (!enabled && context.onlyEnabled) return { drawElement: null, usedVariables, compositeElement: null }

	const drawElement: ButtonGraphicsBoxDrawElement = {
		id: idPrefix + element.id,
		type: 'box',
		usage: element.usage,
		enabled,
		opacity: helper.getNumber('opacity', 1, 0.01),
		...convertDrawBounds(helper),
		rotation: helper.getNumber('rotation', 0),
		color: helper.getColor('color', 0),
		cornerRadius: helper.getNumber('cornerRadius', 0, 0.01),

		...convertBorderProperties(helper),
		contentHash: '', // Will be computed below
	}

	drawElement.contentHash = computeElementContentHash(drawElement)
	return { drawElement, usedVariables, compositeElement: null }
}

function convertLineElementForDrawing(
	context: ParseElementsContext,
	element: ButtonGraphicsLineElement,
	idPrefix: string
): ElementConversionCacheEntry {
	const { helper, usedVariables } = context.createHelper(element)

	// Perform enabled check first, to avoid executing expressions when not needed
	const enabled = helper.getBoolean('enabled', true)
	if (!enabled && context.onlyEnabled) return { drawElement: null, usedVariables, compositeElement: null }

	const drawElement: ButtonGraphicsLineDrawElement = {
		id: idPrefix + element.id,
		type: 'line',
		usage: element.usage,
		enabled,
		opacity: helper.getNumber('opacity', 1, 0.01),
		fromX: helper.getNumber('fromX', 0, 0.01),
		fromY: helper.getNumber('fromY', 0, 0.01),
		toX: helper.getNumber('toX', 1, 0.01),
		toY: helper.getNumber('toY', 1, 0.01),

		...convertBorderProperties(helper),
		contentHash: '', // Will be computed below
	}

	drawElement.contentHash = computeElementContentHash(drawElement)
	return { drawElement, usedVariables, compositeElement: null }
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
	context: ParseElementsContext,
	element: ButtonGraphicsCircleElement,
	idPrefix: string
): ElementConversionCacheEntry {
	const { helper, usedVariables } = context.createHelper(element)

	// Perform enabled check first, to avoid executing expressions when not needed
	const enabled = helper.getBoolean('enabled', true)
	if (!enabled && context.onlyEnabled) return { drawElement: null, usedVariables, compositeElement: null }

	const drawElement: ButtonGraphicsCircleDrawElement = {
		id: idPrefix + element.id,
		type: 'circle',
		usage: element.usage,
		enabled,
		opacity: helper.getNumber('opacity', 1, 0.01),
		...convertDrawBounds(helper),
		color: helper.getColor('color', 0),
		startAngle: helper.getNumber('startAngle', 0),
		endAngle: helper.getNumber('endAngle', 360),
		drawSlice: helper.getBoolean('drawSlice', false),
		...convertBorderProperties(helper),
		borderOnlyArc: helper.getBoolean('borderOnlyArc', false),
		contentHash: '', // Will be computed below
	}

	drawElement.contentHash = computeElementContentHash(drawElement)
	return { drawElement, usedVariables, compositeElement: null }
}

function convertGaugeElementForDrawing(
	context: ParseElementsContext,
	element: ButtonGraphicsGaugeElement,
	idPrefix: string
): ElementConversionCacheEntry {
	const { helper, usedVariables } = context.createHelper(element)

	const enabled = helper.getBoolean('enabled', true)
	if (!enabled && context.onlyEnabled) return { drawElement: null, usedVariables, compositeElement: null }

	// Color stops carry values in the authored Min..Max domain; the renderer normalises them to
	// track positions. Values are intentionally not clamped here so the renderer can map them.
	const stopsRaw = (element.stops as ExpressionOrValue<JsonValue[]>).value
	const stops: ButtonGraphicsGaugeDrawElement['stops'] = Array.isArray(stopsRaw)
		? stopsRaw.map((row) => {
				const rowHelper = helper.forRow(row)
				return {
					value: rowHelper.getNumber('value', 0),
					color: rowHelper.getColor('color', 0, false), // gauge stop color field disables alpha
					gradient: rowHelper.getBoolean('gradient', false),
				}
			})
		: []

	const drawElement: ButtonGraphicsGaugeDrawElement = {
		id: idPrefix + element.id,
		type: 'gauge',
		usage: element.usage,
		enabled,
		opacity: helper.getNumber('opacity', 1, 0.01),
		...convertDrawBounds(helper),
		rotation: helper.getNumber('rotation', 0),
		// Value-mapping fields are kept in the authored domain; the renderer normalises to 0–100.
		value: helper.getNumber('value', 0),
		min: helper.getNumber('min', 0),
		max: helper.getNumber('max', 100),
		origin: helper.getNumber('origin', 0),
		symmetric: helper.getBoolean('symmetric', false),
		orientation: helper.getTolerantEnum('orientation', GAUGE_ORIENTATION_CHOICES, 'horizontal'),
		reverse: helper.getBoolean('reverse', false),
		trackWidth: Math.max(0, Math.min(100, helper.getNumber('trackWidth', 100))),
		startAngle: helper.getNumber('startAngle', 0),
		endAngle: helper.getNumber('endAngle', 360),
		ringWidth: Math.max(1, Math.min(50, helper.getNumber('ringWidth', 20))),
		roundedEnds: helper.getBoolean('roundedEnds', true),
		fillEnabled: helper.getBoolean('fillEnabled', true),
		multiColour: helper.getBoolean('multiColour', true),
		stops: stops,
		markerEnabled: helper.getBoolean('markerEnabled', false),
		markerColor: helper.getColor('markerColor', 0xffffff),
		markerWidth: Math.max(1, Math.min(100, helper.getNumber('markerWidth', 15))),
		trackStyle: helper.getTolerantEnum('trackStyle', GAUGE_TRACK_STYLE_CHOICES, 'transparent'),
		trackAmount: Math.max(0, Math.min(100, helper.getNumber('trackAmount', 70))),
		contentHash: '',
	}

	drawElement.contentHash = computeElementContentHash(drawElement)
	return { drawElement, usedVariables, compositeElement: null }
}

function convertBorderProperties(
	helper: ElementExpressionHelper<ButtonGraphicsBorder & ButtonGraphicsElementBase>
): ButtonGraphicsDrawBorder {
	return {
		borderWidth: helper.getNumber('borderWidth', 0, 0.01),
		borderColor: helper.getColor('borderColor', 0),
		borderPosition: helper.getEnum('borderPosition', BORDER_POSITION_CHOICES, 'inside'),
	}
}

/**
 * Recursively collect element IDs from children without converting them.
 * Used to preserve cache entries for children of disabled groups/composites,
 * so re-enabling the parent can reuse cached children without recomputation.
 */
function collectChildElementIds(
	context: ParseElementsContext,
	children: readonly SomeButtonGraphicsElement[],
	idPrefix: string
): void {
	for (const child of children) {
		const childId = idPrefix + child.id
		context.processedElementIds.add(childId)

		// If this child is a group, recurse with same prefix
		if (child.type === 'group') {
			collectChildElementIds(context, child.children, idPrefix)
		}

		// If this child is a composite, we need to check if we have a cached entry
		// to determine the correct childIdPrefix for its children
		if (child.type === 'composite') {
			const cachedEntry = context.cache?.get(childId)
			if (cachedEntry?.compositeElement) {
				const compositeChildren = context.resolveCompositeElement(child.connectionId, child.elementId)?.elements
				if (compositeChildren) {
					collectChildElementIds(context, compositeChildren, cachedEntry.compositeElement.childIdPrefix)
				}
			}
		}
	}
}
