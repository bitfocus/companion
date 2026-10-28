import EventEmitter from 'node:events'
import type { ElementRasterCanvas } from '@companion-app/shared/Graphics/ElementRaster.js'

/**
 * A preview of a control open in a client, such as the button editor. The element streams of the preview are
 * attached to it, and draw the elements the preview can't draw itself for its canvas.
 */
export interface PreviewContext {
	readonly controlId: string
	canvas: ElementRasterCanvas
	/** Set once the context has ended, so anything attached to it should end too */
	ended: boolean
	readonly events: EventEmitter<{ canvasChanged: []; ended: [] }>
}

interface PreviewContextEntry {
	readonly context: PreviewContext
	/** How many subscriptions hold it open. More than one only while a reconnecting client resubscribes */
	holders: number
}

/**
 * The preview contexts open in the clients. A context id is chosen by its client, so that it is unchanged when the
 * client reconnects and resubscribes, and is scoped to that client so no other client can use or change it.
 */
export class PreviewContexts {
	readonly #contexts = new Map<string, PreviewContextEntry>()
	readonly #opened = new EventEmitter<{ opened: [key: string] }>()

	constructor() {
		// Every element stream of a preview can be waiting for its context to open
		this.#opened.setMaxListeners(0)
	}

	static #key(clientId: string, contextId: string): string {
		return `${clientId}::${contextId}`
	}

	/**
	 * Open a context, or hold open the existing one with this id
	 * @returns A function to release it, which ends the context once nothing else holds it
	 */
	open(clientId: string, contextId: string, controlId: string, canvas: ElementRasterCanvas): () => void {
		const key = PreviewContexts.#key(clientId, contextId)

		let entry = this.#contexts.get(key)
		if (entry) {
			if (entry.context.controlId !== controlId) throw new Error('Preview context is already open for another control')
			entry.holders++
			this.setCanvas(clientId, contextId, canvas)
		} else {
			entry = {
				context: { controlId, canvas, ended: false, events: new EventEmitter() },
				holders: 1,
			}
			entry.context.events.setMaxListeners(0)
			this.#contexts.set(key, entry)
			this.#opened.emit('opened', key)
		}

		let released = false
		const openedEntry = entry
		return () => {
			if (released) return
			released = true

			openedEntry.holders--
			if (openedEntry.holders > 0) return

			this.#contexts.delete(key)
			openedEntry.context.ended = true
			openedEntry.context.events.emit('ended')
		}
	}

	/**
	 * Change the canvas of a context
	 * @returns Whether the context exists
	 */
	setCanvas(clientId: string, contextId: string, canvas: ElementRasterCanvas): boolean {
		const entry = this.#contexts.get(PreviewContexts.#key(clientId, contextId))
		if (!entry) return false

		const { context } = entry
		if (
			context.canvas.width !== canvas.width ||
			context.canvas.height !== canvas.height ||
			context.canvas.paddingX !== canvas.paddingX ||
			context.canvas.paddingY !== canvas.paddingY
		) {
			context.canvas = canvas
			context.events.emit('canvasChanged')
		}
		return true
	}

	/**
	 * Get a context, waiting for it to open if it hasn't yet. An element stream can be subscribed before its
	 * context, as both are resubscribed together when a client reconnects
	 * @returns The context, or null if the wait was aborted first
	 */
	async waitFor(clientId: string, contextId: string, signal: AbortSignal): Promise<PreviewContext | null> {
		const key = PreviewContexts.#key(clientId, contextId)

		const existing = this.#contexts.get(key)
		if (existing) return existing.context
		if (signal.aborted) return null

		return new Promise((resolve) => {
			const onOpened = (openedKey: string) => {
				if (openedKey !== key) return
				cleanup()
				resolve(this.#contexts.get(key)?.context ?? null)
			}
			const onAbort = () => {
				cleanup()
				resolve(null)
			}
			const cleanup = () => {
				this.#opened.off('opened', onOpened)
				signal.removeEventListener('abort', onAbort)
			}

			this.#opened.on('opened', onOpened)
			signal.addEventListener('abort', onAbort, { once: true })
		})
	}
}
