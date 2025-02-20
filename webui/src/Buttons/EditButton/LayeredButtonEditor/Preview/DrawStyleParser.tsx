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
import { cloneDeep } from 'lodash-es'
import { PromiseDebounce } from '@companion-app/shared/PromiseDebounce.js'
import { useContext, useEffect, useMemo, useState } from 'react'
import { RootAppStoreContext } from '../../../../Stores/RootAppStore.js'
import { useObserver } from 'mobx-react-lite'
import { toJS } from 'mobx'
import type { LayeredStyleStore } from '../StyleStore.js'

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
		for (const subId of this.#latestValues.keys()) {
			this.#socket.emitPromise('variables:stream-expression:unsubscribe', [subId]).catch((e) => {
				console.error('Failed to unsubscribe from stream', e)
			})
		}
	}

	updateStyle(style: SomeButtonGraphicsElement[]) {
		if (this.#disposed) return

		// Clone and store the raw elements
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
			}
		)

		// Unsubscribe from any streams that are no longer used
		for (const subId of this.#latestValues.keys()) {
			if (!referencedExpressions.has(subId)) {
				this.#socket.emitPromise('variables:stream-expression:unsubscribe', [subId]).catch((e) => {
					console.error('Failed to unsubscribe from stream', e)
				})
				this.#latestValues.delete(subId)
			}
		}

		// Emit the new elements
		this.#changed(elements)
	}, 10)

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

export function useLayeredButtonDrawStyleParser(
	controlId: string | null,
	styleStore: LayeredStyleStore
): SomeButtonGraphicsDrawElement[] | null {
	const { socket } = useContext(RootAppStoreContext)

	const [drawStyle, setDrawStyle] = useState<SomeButtonGraphicsDrawElement[] | null>(null)

	// Setup the parser
	const parser = useMemo(
		() => new LayeredButtonDrawStyleParser(socket, controlId, setDrawStyle),
		[socket, controlId, setDrawStyle]
	)

	// Dispose the parser when the component unmounts
	useEffect(() => {
		return () => parser.dispose()
	}, [parser])

	// Trigger the update whenever the style changes
	useObserver(() => parser.updateStyle(toJS(styleStore.elements)))

	return drawStyle
}
