import type { CompanionSocketWrapped } from '../../../../util.js'
import type {
	SomeButtonGraphicsDrawElement,
	SomeButtonGraphicsElement,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import { ConvertSomeButtonGraphicsElementForDrawing } from '@companion-app/shared/Graphics/ConvertGraphicsElements.js'
import {
	ExecuteExpressionResult,
	ExpressionStreamResult,
	ExpressionStreamResultWithSubId,
} from '@companion-app/shared/Expression/ExpressionResult.js'
import { cloneDeep, isEqual } from 'lodash-es'
import { PromiseDebounce } from '@companion-app/shared/PromiseDebounce.js'
import { useContext, useEffect, useState } from 'react'
import { RootAppStoreContext } from '../../../../Stores/RootAppStore.js'
import { useObserver } from 'mobx-react-lite'
import { toJS } from 'mobx'
import type { LayeredStyleStore } from '../StyleStore.js'

const DRAW_DEBOUNCE = 50
const emptySet = new Set<string>()

class LayeredButtonDrawStyleParser {
	// readonly #parsedId = nanoid()
	readonly #socket: CompanionSocketWrapped
	readonly #controlId: string | null
	readonly #changed: (style: SomeButtonGraphicsDrawElement[]) => void
	readonly #unsubSocket: () => void

	readonly #latestValues = new Map<string, ExpressionStreamResultWithSubId | Promise<ExpressionStreamResultWithSubId>>()
	#rawElements: SomeButtonGraphicsElement[] = []

	#disposed = false

	constructor(
		socket: CompanionSocketWrapped,
		controlId: string | null,
		changed: (style: SomeButtonGraphicsDrawElement[]) => void
	) {
		this.#socket = socket
		this.#controlId = controlId
		this.#changed = changed

		this.#unsubSocket = this.#socket.on('variables:stream-expression:update', this.#streamUpdate)
	}

	dispose() {
		this.#disposed = true

		this.#unsubSocket()

		// Unsubscribe from all streams
		for (const sub of this.#latestValues.values()) {
			this.#unsubscribeExpression(sub)
		}
	}

	updateStyle(style: SomeButtonGraphicsElement[]) {
		if (this.#disposed) return

		// Clone and store the raw elements
		// TODO - it would be nice to skip this equality check, but the parent observer triggers too often..
		if (isEqual(this.#rawElements, style)) return
		this.#rawElements = cloneDeep(style)

		// Queue update
		this.#recalculateStyle.call()
	}

	#recalculateStyle = new PromiseDebounce(async () => {
		const referencedExpressions = new Set<string>()

		const { elements } = await ConvertSomeButtonGraphicsElementForDrawing(
			this.#rawElements,
			async (str: string, requiredType?: string): Promise<ExecuteExpressionResult> => {
				// Mark it as active, so we don't unsubscribe
				referencedExpressions.add(str)

				// Reuse existing value
				const existing = this.#latestValues.get(str)
				if (existing) return convertExpressionResult(await existing)

				// Start a new stream
				const newValuePromise = this.#socket
					.emitPromise('variables:stream-expression:subscribe', [str, this.#controlId, requiredType])
					.catch((e) => {
						console.error('Failed to subscribe to expression', e)
						return {
							subId: '',
							result: {
								ok: false,
								error: 'Failed to subscribe to expression',
							},
						} satisfies ExpressionStreamResultWithSubId
					})

				// Track the new value, to avoid duplicateion
				this.#latestValues.set(str, newValuePromise)

				return convertExpressionResult(await newValuePromise)
			},
			false
		)

		// Unsubscribe from any streams that are no longer used
		for (const [expression, sub] of this.#latestValues) {
			if (!referencedExpressions.has(expression)) {
				this.#unsubscribeExpression(sub)
				this.#latestValues.delete(expression)
			}
		}

		// Emit the new elements
		this.#changed(elements)
	}, DRAW_DEBOUNCE)

	#unsubscribeExpression(stream: ExpressionStreamResultWithSubId | Promise<ExpressionStreamResultWithSubId>): void {
		Promise.resolve(stream)
			.then((stream) => {
				return this.#socket.emitPromise('variables:stream-expression:unsubscribe', [stream.subId])
			})
			.catch((e) => {
				console.error('Failed to unsubscribe from stream', e)
			})
	}

	#streamUpdate = (expression: string, result: ExpressionStreamResult) => {
		if (this.#disposed) return

		const existing = this.#latestValues.get(expression)
		if (!existing) return

		if (existing instanceof Promise) {
			// Chain the promise, as we need to preserve the subId
			this.#latestValues.set(
				expression,
				existing.then((old) => ({ ...old, result }))
			)
		} else {
			// Update to a concrete value
			this.#latestValues.set(expression, { ...existing, result })
		}

		// Queue update
		this.#recalculateStyle.call()
	}
}

function convertExpressionResult(fromValue: ExpressionStreamResultWithSubId): ExecuteExpressionResult {
	if (fromValue.result.ok) {
		return {
			ok: true,
			value: fromValue.result.value,
			variableIds: emptySet,
		}
	} else {
		return {
			ok: false,
			error: fromValue.result.error,
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
): SomeButtonGraphicsDrawElement[] | null {
	const { socket } = useContext(RootAppStoreContext)

	const [drawStyle, setDrawStyle] = useState<SomeButtonGraphicsDrawElement[] | null>(null)
	const [parser, setParser] = useState<LayeredButtonDrawStyleParser | null>(null)

	// Reset the draw style when the store changes
	useEffect(() => setDrawStyle(null), [styleStore])

	// This is weird, but we need the cleanup function, so can't use useMemo
	useEffect(() => {
		const parser = new LayeredButtonDrawStyleParser(socket, controlId, setDrawStyle)
		parser.updateStyle(toJS(styleStore.elements))

		setParser(parser)

		return () => {
			setParser(null)
			parser.dispose()
		}
	}, [socket, controlId, styleStore, setDrawStyle])

	// Trigger the update whenever the style changes
	useObserver(() => parser?.updateStyle(toJS(styleStore.elements)))

	return drawStyle
}
