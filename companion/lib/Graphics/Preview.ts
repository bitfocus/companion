import type { ControlLocation, WrappedImage } from '@companion-app/shared/Model/Common.js'
import { ParseInternalControlReference } from '../Internal/Util.js'
import LogController from '../Log/Controller.js'
import type { GraphicsController } from './Controller.js'
import type { IPageStore } from '../Page/Store.js'
import type { ImageResult } from './ImageResult.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import z from 'zod'
import EventEmitter from 'node:events'
import { nanoid } from 'nanoid'
import type { ControlsController } from '../Controls/Controller.js'

export const zodLocation: z.ZodSchema<ControlLocation> = z.object({
	pageNumber: z.number().min(1),
	row: z.number(),
	column: z.number(),
})

type PreviewRenderEvents = {
	[id: `location:${string}`]: [image: WrappedImage]
	[id: `controlId:${string}`]: [dataUrl: string | null]
	[id: `reference:${string}`]: [dataUrl: string | null]
}

const getLocationSubId = (location: ControlLocation): string =>
	`${location.pageNumber}_${location.row}_${location.column}`

/**
 * The class that manages button preview generation/relay for interfaces
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 1.0.9
 * @copyright 2022 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 */
export class GraphicsPreview {
	readonly #logger = LogController.createLogger('Graphics/Preview')

	readonly #graphicsController: GraphicsController
	readonly #pageStore: IPageStore
	readonly #controlsController: ControlsController

	readonly #buttonReferencePreviews = new Map<string, PreviewSession>()

	readonly #renderEvents = new EventEmitter<PreviewRenderEvents>()

	constructor(graphicsController: GraphicsController, pageStore: IPageStore, controlsController: ControlsController) {
		this.#graphicsController = graphicsController
		this.#pageStore = pageStore
		this.#controlsController = controlsController

		this.#graphicsController.on('button_drawn', this.#updateButton.bind(this))
		this.#renderEvents.setMaxListeners(0)
	}

	createTrpcRouter() {
		const self = this
		return router({
			location: publicProcedure
				.input(
					z.object({
						location: zodLocation,
					})
				)
				.subscription(async function* ({ signal, input }) {
					const { location } = input
					const locationId = getLocationSubId(location)

					const changes = toIterable(self.#renderEvents, `location:${locationId}`, signal)

					const render = self.#graphicsController.getCachedRenderOrGeneratePlaceholder(location)
					yield { image: render.asDataUrl, isUsed: !!render.style } satisfies WrappedImage

					for await (const [image] of changes) {
						yield image
					}
				}),

			controlId: publicProcedure
				.input(
					z.object({
						controlId: z.string(),
					})
				)
				.subscription(async function* ({ signal, input }) {
					const { controlId } = input

					const changes = toIterable(self.#renderEvents, `controlId:${controlId}`, signal)

					// Send the preview image shortly after
					const location = self.#pageStore.getLocationOfControlId(controlId)
					const originalImg = location ? self.#graphicsController.getCachedRenderOrGeneratePlaceholder(location) : null
					yield originalImg?.asDataUrl ?? null

					for await (const [image] of changes) {
						yield image
					}
				}),

			reference: publicProcedure
				.input(
					z.object({
						location: zodLocation.optional(),
						options: z.object({}).catchall(z.any()),
					})
				)
				.subscription(async function* ({ signal, input }) {
					const { location, options } = input
					const id = nanoid()

					try {
						if (self.#buttonReferencePreviews.get(id)) throw new Error('Session id is already in use')

						// Start wathing for changes to the reference
						const changes = toIterable(self.#renderEvents, `reference:${id}`, signal)

						const parser = self.#controlsController.createVariablesAndExpressionParser(location, null)

						// Do a resolve of the reference for the starting image
						const result = ParseInternalControlReference(self.#logger, parser, location, options, true)

						// Track the subscription, to allow it to be invalidated
						self.#buttonReferencePreviews.set(id, {
							id,
							location,
							options,
							resolvedLocation: result.location,
							referencedVariableIds: Array.from(result.referencedVariables),
						})

						// Emit the initial image
						yield result.location
							? self.#graphicsController.getCachedRenderOrGeneratePlaceholder(result.location).asDataUrl
							: null

						for await (const [image] of changes) {
							yield image
						}
					} finally {
						// Cleanup the session on termination
						self.#buttonReferencePreviews.delete(id)
					}
				}),
		})
	}

	/**
	 * Send a button update to the UIs
	 */
	#updateButton(location: ControlLocation, render: ImageResult): void {
		// Push the updated render to any clients viewing a preview of a control
		const controlId = this.#pageStore.getControlIdAt(location)
		if (controlId) {
			this.#renderEvents.emit(`controlId:${controlId}`, render.asDataUrl)
		}

		this.#renderEvents.emit(`location:${getLocationSubId(location)}`, {
			image: render.asDataUrl,
			isUsed: !!render.style,
		})

		// Lookup any sessions
		for (const previewSession of this.#buttonReferencePreviews.values()) {
			if (!previewSession.resolvedLocation) continue
			if (previewSession.resolvedLocation.pageNumber != location.pageNumber) continue
			if (previewSession.resolvedLocation.row != location.row) continue
			if (previewSession.resolvedLocation.column != location.column) continue

			this.#renderEvents.emit(`reference:${previewSession.id}`, render.asDataUrl)
		}
	}

	onVariablesChanged(allChangedSet: Set<string>): void {
		// Lookup any sessions
		for (const previewSession of this.#buttonReferencePreviews.values()) {
			if (!previewSession.referencedVariableIds || !previewSession.referencedVariableIds.length) continue

			const matchingChangedVariable = previewSession.referencedVariableIds.some((variable) =>
				allChangedSet.has(variable)
			)
			if (!matchingChangedVariable) continue

			const parser = this.#controlsController.createVariablesAndExpressionParser(previewSession.location, null)

			// Resolve the new location
			const result = ParseInternalControlReference(
				this.#logger,
				parser,
				previewSession.location,
				previewSession.options,
				true
			)

			const lastResolvedLocation = previewSession.resolvedLocation

			previewSession.referencedVariableIds = Array.from(result.referencedVariables)
			previewSession.resolvedLocation = result.location

			if (!result.location) {
				// Now has an invalid location
				this.#renderEvents.emit(`reference:${previewSession.id}`, null)
				continue
			}

			// Check if it has changed
			if (
				lastResolvedLocation &&
				result.location.pageNumber == lastResolvedLocation.pageNumber &&
				result.location.row == lastResolvedLocation.row &&
				result.location.column == lastResolvedLocation.column
			)
				continue

			this.#renderEvents.emit(
				`reference:${previewSession.id}`,
				this.#graphicsController.getCachedRenderOrGeneratePlaceholder(result.location).asDataUrl
			)
		}
	}
}

interface PreviewSession {
	id: string
	location: ControlLocation | undefined
	options: Record<string, any>
	resolvedLocation: ControlLocation | null
	referencedVariableIds: string[]
}
