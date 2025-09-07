import type {
	SomeButtonGraphicsElement,
	SomeButtonGraphicsDrawElement,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import { cloneDeep, isEqual } from 'lodash-es'
import { PromiseDebounce } from '@companion-app/shared/PromiseDebounce.js'
import { useEffect, useState } from 'react'
import { useObserver } from 'mobx-react-lite'
import { toJS } from 'mobx'
import type { LayeredStyleStore } from '../StyleStore.js'
import { DrawStyleLayeredButtonModel } from '@companion-app/shared/Model/StyleModel.js'
import { RouterInput, trpcClient } from '~/Resources/TRPC.js'
import type { ExecuteExpressionResult } from '@companion-app/shared/Expression/ExpressionResult.js'
import type { ElementStreamResult } from '~/../companion/lib/Preview/ElementStream.js'

const DRAW_DEBOUNCE = 50
const DRAW_DEBOUNCE_MAX = 100
const emptySet = new Set<string>()

interface CachedElementValue {
	unsub: () => void
	value: ElementStreamResult | Promise<ElementStreamResult>
}

interface CachedExpressionValue {
	unsub: () => void
	value: ExecuteExpressionResult | Promise<ExecuteExpressionResult>
}

class LayeredButtonDrawStyleParser {
	readonly #controlId: string | null
	readonly #changed: (style: DrawStyleLayeredButtonModel) => void

	readonly #elementValues = new Map<string, CachedElementValue>()
	readonly #expressionValues = new Map<string, CachedExpressionValue>()
	#rawElements: SomeButtonGraphicsElement[] = []

	#disposed = false

	constructor(controlId: string | null, changed: (style: DrawStyleLayeredButtonModel) => void) {
		this.#controlId = controlId
		this.#changed = changed
	}

	dispose() {
		this.#disposed = true

		// Unsubscribe from all streams
		for (const sub of this.#elementValues.values()) {
			sub.unsub()
		}
		for (const sub of this.#expressionValues.values()) {
			sub.unsub()
		}
	}

	updateStyle(style: SomeButtonGraphicsElement[]) {
		if (this.#disposed) return

		// Clone and store the raw elements
		// TODO - it would be nice to skip this equality check, but the parent observer triggers too often..
		if (isEqual(this.#rawElements, style)) return
		this.#rawElements = cloneDeep(style)

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
					if (element.type === 'group') {
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

						const sub = trpcClient.preview.elementStream.watchElement.subscribe(
							{
								controlId: this.#controlId,
								elementId,
							},
							{
								onData: (result) => updateValue(result as ElementStreamResult), // TODO - fix this type
								onError: (error) => {
									console.error('Subscription to element errored:', error)
									// TODO: handle error case
								},
							}
						)

						// Track the new value, to avoid duplication
						this.#elementValues.set(elementId, {
							unsub: () => sub.unsubscribe(),
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

				const sub = trpcClient.preview.expressionStream.watchExpression.subscribe(args, {
					onData: (result) => updateValue(result as ExecuteExpressionResult), // TODO - fix this type
					onError: (error) => {
						console.error('Subscription to expression errored:', error)
						updateValue({
							ok: false,
							error: 'Subscription failed',
							variableIds: emptySet,
						})
					},
				})

				// Track the new value, to avoid duplication
				this.#expressionValues.set(streamId, {
					unsub: () => sub.unsubscribe(),
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
				parseExpression('$(this:pushed)', 'boolean'),
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
					sub.unsub()
					this.#elementValues.delete(elementId)
				}
			}
			for (const [expression, sub] of this.#expressionValues) {
				if (!referencedExpressions.has(expression)) {
					sub.unsub()
					this.#expressionValues.delete(expression)
				}
			}

			// Emit the new elements
			this.#changed({
				style: 'button-layered',

				elements,

				pushed: thisPushed.ok ? Boolean(thisPushed.value) : false,
				stepCount: thisStepCount.ok ? Number(thisStepCount.value) : 1,
				stepCurrent: thisStep.ok && thisStep.value ? Number(thisStep.value) : 1,

				cloud: undefined,
				cloud_error: undefined,

				button_status: thisButtonStatus.ok
					? (String(thisButtonStatus.value) as 'error' | 'warning' | 'good')
					: undefined,
				action_running: thisActionsRunning.ok ? Boolean(thisActionsRunning.value) : undefined,
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
 * @returns The parsed draw style, or null if not yet ready
 */
export function useLayeredButtonDrawStyleParser(
	controlId: string | null,
	styleStore: LayeredStyleStore
): DrawStyleLayeredButtonModel | null {
	const [drawStyle, setDrawStyle] = useState<DrawStyleLayeredButtonModel | null>(null)
	const [parser, setParser] = useState<LayeredButtonDrawStyleParser | null>(null)

	// Reset the draw style when the store changes
	useEffect(() => setDrawStyle(null), [styleStore])

	// This is weird, but we need the cleanup function, so can't use useMemo
	useEffect(() => {
		const parser = new LayeredButtonDrawStyleParser(controlId, setDrawStyle)
		parser.updateStyle(toJS(styleStore.elements))

		setParser(parser)

		return () => {
			setParser(null)
			parser.dispose()
		}
	}, [controlId, styleStore, setDrawStyle])

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
		this.#cache.set(key, { data, dispose })
	}

	disposeUnused(): void {
		for (const [key, entry] of this.#cache) {
			if (!this.#usedSinceReset.has(key)) {
				this.#cache.delete(key)
				entry.dispose?.()
				console.log('dispose', key)
			}
		}

		this.#usedSinceReset.clear()
	}
}
