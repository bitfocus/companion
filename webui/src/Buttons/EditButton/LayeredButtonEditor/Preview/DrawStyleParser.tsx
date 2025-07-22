import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { ConvertSomeButtonGraphicsElementForDrawing } from '@companion-app/shared/Graphics/ConvertGraphicsElements.js'
import type {
	ExecuteExpressionResult,
	ExpressionStreamResult,
} from '@companion-app/shared/Expression/ExpressionResult.js'
import { cloneDeep, isEqual } from 'lodash-es'
import { PromiseDebounce } from '@companion-app/shared/PromiseDebounce.js'
import { useEffect, useState } from 'react'
import { useObserver } from 'mobx-react-lite'
import { toJS } from 'mobx'
import type { LayeredStyleStore } from '../StyleStore.js'
import { DrawStyleLayeredButtonModel } from '@companion-app/shared/Model/StyleModel.js'
import { RouterInput, trpcClient } from '~/Resources/TRPC.js'

const DRAW_DEBOUNCE = 50
const DRAW_DEBOUNCE_MAX = 100
const emptySet = new Set<string>()

interface CachedValue {
	unsub: () => void
	value: ExpressionStreamResult | Promise<ExpressionStreamResult>
}

class LayeredButtonDrawStyleParser {
	// readonly #parsedId = nanoid()
	readonly #controlId: string | null
	readonly #changed: (style: DrawStyleLayeredButtonModel) => void

	readonly #latestValues = new Map<string, CachedValue>()
	#rawElements: SomeButtonGraphicsElement[] = []

	#disposed = false

	constructor(controlId: string | null, changed: (style: DrawStyleLayeredButtonModel) => void) {
		this.#controlId = controlId
		this.#changed = changed
	}

	dispose() {
		this.#disposed = true

		// Unsubscribe from all streams
		for (const sub of this.#latestValues.values()) {
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
			const referencedExpressions = new Set<string>()
			const runStream = async (
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
				const existing = this.#latestValues.get(streamId)
				if (existing) return convertExpressionResult(await existing.value)

				// Start a new stream
				const firstRunPromise = Promise.withResolvers<ExpressionStreamResult>()
				let hasReceivedFirstValue = false
				const updateValue = (value: ExpressionStreamResult) => {
					if (this.#disposed) return

					if (!hasReceivedFirstValue) {
						hasReceivedFirstValue = true
						firstRunPromise.resolve(value)
						return
					}

					// Notify the reactive observers
					const existing = this.#latestValues.get(streamId)
					if (!existing) return

					// Update to a concrete value
					existing.value = value

					// Queue update
					this.#recalculateStyle.trigger()
				}

				const sub = trpcClient.preview.expressionStream.watchExpression.subscribe(args, {
					onData: (result) => updateValue(result as ExpressionStreamResult), // TODO - fix this type
					onError: (error) => {
						console.error('Subscription to expression errored:', error)
						updateValue({
							ok: false,
							error: 'Subscription failed',
						})
					},
				})

				// Track the new value, to avoid duplicateion
				this.#latestValues.set(streamId, {
					unsub: () => sub.unsubscribe(),
					value: firstRunPromise.promise,
				})

				return convertExpressionResult(await firstRunPromise.promise)
			}
			const parseExpression = async (str: string, requiredType?: string): Promise<ExecuteExpressionResult> =>
				runStream(`expression::${str}`, {
					expression: str,
					controlId: this.#controlId,
					requiredType,
					isVariableString: false,
				})

			const parseVariablesInString = async (str: string): Promise<ExecuteExpressionResult> =>
				runStream(`variable::${str}`, {
					expression: str,
					controlId: this.#controlId,
					requiredType: undefined,
					isVariableString: true,
				})

			const [{ elements }, thisPushed, thisStepCount, thisStep, thisButtonStatus, thisActionsRunning] =
				await Promise.all([
					ConvertSomeButtonGraphicsElementForDrawing(this.#rawElements, parseExpression, parseVariablesInString, false),
					parseExpression('$(this:pushed)', 'boolean'),
					parseExpression('$(this:step_count)', 'number'),
					parseExpression('$(this:step_count) > 1 ? $(this:step) : 0', 'number'),
					parseExpression('$(this:button_status)', 'string'),
					parseExpression('$(this:actions_running)', 'boolean'),
				])

			// Unsubscribe from any streams that are no longer used
			for (const [expression, sub] of this.#latestValues) {
				if (!referencedExpressions.has(expression)) {
					sub.unsub()
					this.#latestValues.delete(expression)
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

function convertExpressionResult(fromValue: ExpressionStreamResult): ExecuteExpressionResult {
	if (fromValue.ok) {
		return {
			ok: true,
			value: fromValue.value,
			variableIds: emptySet,
		}
	} else {
		return {
			ok: false,
			error: fromValue.error,
			variableIds: emptySet,
		}
	}
}

/**
 * Hook to parse a layered button draw style, replacing any expressions with real values
 * This subscribes to the necessary expressions on the backend, to update as the button should be redrawn
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
