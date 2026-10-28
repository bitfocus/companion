import isEqual from 'fast-deep-equal'
import { toJS } from 'mobx'
import { useObserver } from 'mobx-react-lite'
import { nanoid } from 'nanoid'
import { useEffect, useRef, useState } from 'react'
import type { ExecuteExpressionResult } from '@companion-app/shared/ExpressionResult.js'
import type { ElementRasterCanvas } from '@companion-app/shared/Graphics/ElementRaster.js'
import {
	resolveButtonStyleProperties,
	type ResolveButtonStylePropertiesConfig,
} from '@companion-app/shared/Graphics/Util.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { RendererButtonStyle } from '@companion-app/shared/Model/Render.js'
import type {
	SomeButtonGraphicsDrawElement,
	SomeButtonGraphicsElement,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import { stringifyVariableValue } from '@companion-app/shared/Model/Variables.js'
import { PromiseDebounce } from '@companion-app/shared/PromiseDebounce.js'
import type { ElementStreamResult } from '~/../companion/lib/Preview/ElementStream.js'
import { trpcClient, type RouterInput } from '~/Resources/TRPC.js'
import type { LayeredStyleStore } from '../StyleStore.js'

const DRAW_DEBOUNCE = 50
const DRAW_DEBOUNCE_MAX = 100
const emptySet = new Set<string>()

interface CachedElementValue {
	/** Ends the stream */
	abort: AbortController
	value: ElementStreamResult | Promise<ElementStreamResult>
}

interface CachedExpressionValue {
	/** Ends the stream */
	abort: AbortController
	value: ExecuteExpressionResult | Promise<ExecuteExpressionResult>
}

class LayeredButtonDrawStyleParser {
	readonly #controlId: string
	readonly #location: ControlLocation | undefined
	readonly #drawConfig: ResolveButtonStylePropertiesConfig
	readonly #changed: (style: RendererButtonStyle) => void

	/**
	 * The preview context the element streams render for. Elements the preview can't draw identically itself (eg
	 * text) are drawn by the backend for its canvas, and streamed as `raster` elements
	 */
	readonly #contextId = nanoid()
	/** Aborted on dispose, which ends the preview context */
	readonly #abort = new AbortController()
	#canvas: ElementRasterCanvas

	readonly #elementValues = new Map<string, CachedElementValue>()
	readonly #expressionValues = new Map<string, CachedExpressionValue>()
	#rawElements: SomeButtonGraphicsElement[] = []

	#disposed = false

	constructor(
		controlId: string,
		location: ControlLocation | undefined,
		drawConfig: ResolveButtonStylePropertiesConfig,
		changed: (style: RendererButtonStyle) => void,
		canvas: ElementRasterCanvas
	) {
		this.#controlId = controlId
		this.#location = location
		this.#drawConfig = drawConfig
		this.#changed = changed
		this.#canvas = canvas

		trpcClient.preview.elementStream.previewContext.subscribe(
			{ contextId: this.#contextId, controlId, canvas },
			{
				// The context has opened, with the canvas it was subscribed with (also when it reopens after a reconnect).
				// A change since then may have arrived before it opened, so was dropped, so send it again
				onData: () => {
					if (!this.#disposed && !isEqual(this.#canvas, canvas)) this.#sendCanvas()
				},
				onError: (error) => {
					console.error('Subscription to preview context errored:', error)
				},
				signal: this.#abort.signal,
			}
		)
	}

	/** Change the canvas the elements are drawn for, which re-renders those drawn by the backend */
	setCanvas(canvas: ElementRasterCanvas) {
		if (this.#disposed || isEqual(this.#canvas, canvas)) return
		this.#canvas = canvas

		this.#sendCanvas()
	}

	#sendCanvas() {
		trpcClient.preview.elementStream.setPreviewCanvas
			.mutate({ contextId: this.#contextId, canvas: this.#canvas })
			.catch((e) => console.error('Failed to set preview canvas', e))
	}

	dispose() {
		this.#disposed = true
		this.#abort.abort()

		// End all streams
		for (const sub of this.#elementValues.values()) {
			sub.abort.abort()
		}
		for (const sub of this.#expressionValues.values()) {
			sub.abort.abort()
		}
	}

	updateStyle(style: SomeButtonGraphicsElement[]) {
		if (this.#disposed) return

		// Clone and store the raw elements
		// TODO - it would be nice to skip this equality check, but the parent observer triggers too often..
		if (isEqual(this.#rawElements, style)) return
		this.#rawElements = structuredClone(style)

		// Queue update
		this.#recalculateStyle.trigger()
	}

	#recalculateStyle = new PromiseDebounce(
		async () => {
			const referencedElements = new Set<string>()
			const referencedExpressions = new Set<string>()

			// Step 1: Collect all element IDs recursively (including children of groups)
			const allElementIds: string[] = []
			const collectElementIdsRecursively = (elements: SomeButtonGraphicsElement[]) => {
				for (const element of elements) {
					allElementIds.push(element.id)
					if ('children' in element && Array.isArray(element.children)) {
						collectElementIdsRecursively(element.children)
					}
				}
			}
			collectElementIdsRecursively(this.#rawElements)

			// Step 2: Start subscriptions for each element and build a map of resolved data
			const elementDataMap = new Map<string, SomeButtonGraphicsDrawElement>()

			await Promise.all(
				allElementIds.map(async (elementId) => {
					referencedElements.add(elementId)

					// Reuse existing element stream
					const existing = this.#elementValues.get(elementId)
					let resolvedElement: ElementStreamResult

					if (existing) {
						resolvedElement = await existing.value
					} else {
						if (this.#disposed) return

						// Start a new element stream
						const firstRunPromise = Promise.withResolvers<ElementStreamResult>()
						let hasReceivedFirstValue = false
						const updateValue = (value: ElementStreamResult) => {
							if (this.#disposed) return

							if (!hasReceivedFirstValue) {
								hasReceivedFirstValue = true
								firstRunPromise.resolve(value)
								return
							}

							// Notify the reactive observers
							const existing = this.#elementValues.get(elementId)
							if (!existing) return

							// Update to a concrete value
							existing.value = value

							// Queue update
							this.#recalculateStyle.trigger()
						}

						const abort = new AbortController()
						trpcClient.preview.elementStream.watchElement.subscribe(
							{
								contextId: this.#contextId,
								elementId,
							},
							{
								onData: (result) => updateValue(result),
								onError: (error) => {
									console.error('Subscription to element errored:', error)
									// TODO: handle error case
								},
								signal: abort.signal,
							}
						)

						// Track the new value, to avoid duplication
						this.#elementValues.set(elementId, {
							abort,
							value: firstRunPromise.promise,
						})

						resolvedElement = await firstRunPromise.promise
					}

					// Add to map if the element loaded successfully
					if (resolvedElement.ok && resolvedElement.element) {
						elementDataMap.set(elementId, resolvedElement.element)
					}
				})
			)

			// Stream the built-in expressions for this control state
			const runExpressionStream = async (
				streamId: string,
				args: RouterInput['preview']['expressionStream']['watchExpression']
			): Promise<ExecuteExpressionResult> => {
				if (this.#disposed)
					return {
						ok: false,
						error: 'Disposed',
						variableIds: emptySet,
						clockSensitive: false,
					}

				// Mark it as active, so we don't unsubscribe
				referencedExpressions.add(streamId)

				// Reuse existing value
				const existing = this.#expressionValues.get(streamId)
				if (existing) return await existing.value

				// Start a new stream
				const firstRunPromise = Promise.withResolvers<ExecuteExpressionResult>()
				let hasReceivedFirstValue = false
				const updateValue = (value: ExecuteExpressionResult) => {
					if (this.#disposed) return

					if (!hasReceivedFirstValue) {
						hasReceivedFirstValue = true
						firstRunPromise.resolve(value)
						return
					}

					// Notify the reactive observers
					const existing = this.#expressionValues.get(streamId)
					if (!existing) return

					// Update to a concrete value
					existing.value = value

					// Queue update
					this.#recalculateStyle.trigger()
				}

				const abort = new AbortController()
				trpcClient.preview.expressionStream.watchExpression.subscribe(args, {
					onData: (result) => updateValue(result as ExecuteExpressionResult), // TODO - fix this type
					onError: (error) => {
						console.error('Subscription to expression errored:', error)
						updateValue({
							ok: false,
							error: 'Subscription failed',
							variableIds: emptySet,
							clockSensitive: false,
						})
					},
					signal: abort.signal,
				})

				// Track the new value, to avoid duplication
				this.#expressionValues.set(streamId, {
					abort,
					value: firstRunPromise.promise,
				})

				return await firstRunPromise.promise
			}

			const parseExpression = async (str: string, requiredType?: string): Promise<ExecuteExpressionResult> =>
				runExpressionStream(`expression::${str}`, {
					expression: str,
					controlId: this.#controlId,
					requiredType,
					isVariableString: false,
				})

			// Wait for control state expressions
			const [thisPushed, thisStepCount, thisStep, thisButtonStatus, thisActionsRunning] = await Promise.all([
				parseExpression('$(this:active)', 'boolean'),
				parseExpression('$(this:step_count)', 'number'),
				parseExpression('$(this:step_count) > 1 ? $(this:step) : 0', 'number'),
				parseExpression('$(this:button_status)', 'string'),
				parseExpression('$(this:actions_running)', 'boolean'),
			])

			// Step 3: Reconstruct the tree structure using the cached data
			const reconstructTree = (sourceElements: SomeButtonGraphicsElement[]): SomeButtonGraphicsDrawElement[] => {
				const result: SomeButtonGraphicsDrawElement[] = []

				for (const sourceElement of sourceElements) {
					const resolvedElement = elementDataMap.get(sourceElement.id)
					if (!resolvedElement) {
						// Element hasn't loaded yet, skip it
						continue
					}

					if (sourceElement.type === 'group' && resolvedElement.type === 'group') {
						// Recursively reconstruct children for group elements
						const reconstructedChildren = reconstructTree(sourceElement.children)
						result.push({
							...resolvedElement,
							children: reconstructedChildren,
						})
					} else {
						// Non-group element, use as-is
						result.push(resolvedElement)
					}
				}

				return result
			}

			const elements = reconstructTree(this.#rawElements)

			// Unsubscribe from any streams that are no longer used
			for (const [elementId, sub] of this.#elementValues) {
				if (!referencedElements.has(elementId)) {
					sub.abort.abort()
					this.#elementValues.delete(elementId)
				}
			}
			for (const [expression, sub] of this.#expressionValues) {
				if (!referencedExpressions.has(expression)) {
					sub.abort.abort()
					this.#expressionValues.delete(expression)
				}
			}

			// Emit the new elements
			this.#changed({
				style: 'button-layered',
				drawType: 'button',

				elements,

				pushed: thisPushed.ok ? Boolean(thisPushed.value) : false,
				stepCount: thisStepCount.ok ? Number(thisStepCount.value) : 1,
				stepCurrent: thisStep.ok && thisStep.value ? Number(thisStep.value) : 1,

				button_status: thisButtonStatus.ok
					? (stringifyVariableValue(thisButtonStatus.value) as 'error' | 'warning' | 'good')
					: undefined,
				action_running: thisActionsRunning.ok ? Boolean(thisActionsRunning.value) : undefined,

				...resolveButtonStyleProperties(this.#drawConfig, elements),
				location: this.#location,
				decodedImages: null, // The browser decodes images itself
			})
		},
		DRAW_DEBOUNCE,
		DRAW_DEBOUNCE_MAX
	)
}

/**
 * Hook to parse a layered button draw style, replacing any expressions with real values
 * This subscribes to the necessary element streams on the backend, to update as the button should be redrawn
 * @param controlId ControlId of the button to draw, if this is a control
 * @param styleStore The store containing the style to be drawn
 * @param canvas The canvas the button is drawn on, for the backend to draw the elements the preview can't for
 * @returns The parsed draw style, or null if not yet ready
 */
export function useLayeredButtonDrawStyleParser(
	controlId: string,
	location: ControlLocation | undefined,
	drawConfig: ResolveButtonStylePropertiesConfig,
	styleStore: LayeredStyleStore,
	canvas: ElementRasterCanvas
): RendererButtonStyle | null {
	const [drawStyle, setDrawStyle] = useState<RendererButtonStyle | null>(null)
	const [parser, setParser] = useState<LayeredButtonDrawStyleParser | null>(null)
	const canvasRef = useRef(canvas)

	// Reset the draw style when the store changes
	useEffect(() => setDrawStyle(null), [styleStore])

	// This is weird, but we need the cleanup function, so can't use useMemo
	useEffect(() => {
		// Created with the canvas at the time, then kept up to date by the effect below rather than recreated
		const parser = new LayeredButtonDrawStyleParser(controlId, location, drawConfig, setDrawStyle, canvasRef.current)
		parser.updateStyle(toJS(styleStore.elements))

		setParser(parser)

		return () => {
			setParser(null)
			parser.dispose()
		}
	}, [controlId, location, styleStore, drawConfig, setDrawStyle])

	useEffect(() => {
		canvasRef.current = canvas
		parser?.setCanvas(canvas)
	}, [parser, canvas])

	// Trigger the update whenever the style changes
	useObserver(() => parser?.updateStyle(toJS(styleStore.elements)))

	return drawStyle
}

/**
 * A cache that keeps track of the last used items, and disposes of unused items
 */
export class LastUsedCache<T> {
	readonly #cache = new Map<
		string,
		{
			data: T
			dispose?: () => void
		}
	>()

	readonly #usedSinceReset = new Set<string>()

	get(key: string): T | undefined {
		const entry = this.#cache.get(key)
		if (!entry) return undefined

		this.#usedSinceReset.add(key)
		return entry.data
	}

	set(key: string, data: T, dispose?: () => void): void {
		this.#usedSinceReset.add(key)

		// Ensure previous is not leaked
		const previous = this.#cache.get(key)
		if (previous) previous.dispose?.()

		this.#cache.set(key, { data, dispose })
	}

	disposeUnused(): void {
		for (const [key, entry] of this.#cache) {
			if (!this.#usedSinceReset.has(key)) {
				this.#cache.delete(key)
				entry.dispose?.()
			}
		}

		this.#usedSinceReset.clear()
	}
}
