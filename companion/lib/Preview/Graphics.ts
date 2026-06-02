import EventEmitter from 'node:events'
import { nanoid } from 'nanoid'
import z from 'zod'
import type { ControlLocation, WrappedImage } from '@companion-app/shared/Model/Common.js'
import {
	ExpressionableOptionsObjectSchema,
	JsonValueSchema,
	type ExpressionableOptionsObject,
} from '@companion-app/shared/Model/Options.js'
import { stringifyVariableValue } from '@companion-app/shared/Model/Variables.js'
import type { ControlCommonEvents } from '../Controls/ControlDependencies.js'
import type { ControlsController } from '../Controls/Controller.js'
import type { GraphicsController } from '../Graphics/Controller.js'
import type { ImageResult } from '../Graphics/ImageResult.js'
import { ParseLocationString } from '../Internal/Util.js'
import LogController from '../Log/Controller.js'
import type { IPageStore } from '../Page/Store.js'
import { ImageWriteQueue } from '../Resources/ImageWriteQueue.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'

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
export class PreviewGraphics {
	readonly #logger = LogController.createLogger('Graphics/Preview')

	readonly #graphicsController: GraphicsController
	readonly #pageStore: IPageStore
	readonly #controlsController: ControlsController
	readonly #controlEvents: EventEmitter<ControlCommonEvents>

	readonly #buttonReferencePreviews = new Map<string, PreviewSession>()

	readonly #renderEvents = new EventEmitter<PreviewRenderEvents>()

	readonly #updateButtonQueue: ImageWriteQueue<string, [ControlLocation, string | null, ImageResult]>
	readonly #recheckQueue: ImageWriteQueue<string, [string, ControlLocation]>

	constructor(
		graphicsController: GraphicsController,
		pageStore: IPageStore,
		controlsController: ControlsController,
		controlEvents: EventEmitter<ControlCommonEvents>
	) {
		this.#graphicsController = graphicsController
		this.#pageStore = pageStore
		this.#controlsController = controlsController
		this.#controlEvents = controlEvents

		this.#updateButtonQueue = new ImageWriteQueue(
			this.#logger,
			async (locationId: string, location: ControlLocation, controlId: string | null, render: ImageResult) => {
				if (controlId && this.#renderEvents.listenerCount(`controlId:${controlId}`) > 0) {
					this.#renderEvents.emit(`controlId:${controlId}`, await render.drawDataUrl())
				}

				if (this.#renderEvents.listenerCount(`location:${locationId}`) > 0) {
					this.#renderEvents.emit(`location:${locationId}`, {
						image: await render.drawDataUrl(),
						isUsed: !!render.style,
					})
				}

				for (const previewSession of this.#buttonReferencePreviews.values()) {
					if (!previewSession.resolvedLocation) continue
					if (previewSession.resolvedLocation.pageNumber != location.pageNumber) continue
					if (previewSession.resolvedLocation.row != location.row) continue
					if (previewSession.resolvedLocation.column != location.column) continue

					this.#renderEvents.emit(`reference:${previewSession.id}`, await render.drawDataUrl())
				}
			}
		)

		this.#recheckQueue = new ImageWriteQueue(
			this.#logger,
			async (_sessionId: string, sessionId: string, resolvedLocation: ControlLocation) => {
				if (this.#renderEvents.listenerCount(`reference:${sessionId}`) == 0) return

				const dataUrl = await this.#graphicsController
					.getCachedRenderOrGeneratePlaceholder(resolvedLocation)
					.drawDataUrl()
				this.#renderEvents.emit(`reference:${sessionId}`, dataUrl)
			}
		)

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
					const dataUrl = await render.drawDataUrl()
					yield { image: dataUrl, isUsed: !!render.style } satisfies WrappedImage

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
					yield originalImg ? await originalImg.drawDataUrl() : null

					for await (const [image] of changes) {
						yield image
					}
				}),

			preset: publicProcedure
				.input(
					z.object({
						connectionId: z.string(),
						presetId: z.string(),
						variableValues: z.record(z.string(), JsonValueSchema.optional()).nullable(),
					})
				)
				.subscription(async function* ({ signal, input }) {
					const control = self.#controlsController.getOrCreatePresetControl(
						input.connectionId,
						input.presetId,
						input.variableValues
					)
					if (!control) throw new Error(`Preset "${input.presetId}" not found for connection "${input.connectionId}"`)

					// track this session on the control
					const sessionId = nanoid()
					control.addRenderSubscriber(sessionId)

					try {
						const changes = toIterable(self.#controlEvents, 'presetDrawn', signal)

						// Send the preview image shortly after
						const initialRender = control.lastRender
						yield initialRender ? await initialRender.drawDataUrl() : null

						for await (const [controlId, render] of changes) {
							if (controlId !== control.controlId) continue
							yield render ? await render.drawDataUrl() : null
						}
					} finally {
						if (control.removeRenderSubscriberAndCheckEmpty(sessionId)) {
							// No uses left, cleanup the control
							self.#controlsController.deleteControl(control.controlId)
						}
					}
				}),

			reference: publicProcedure
				.input(
					z.object({
						controlId: z.string(),
						options: ExpressionableOptionsObjectSchema,
					})
				)
				.subscription(async function* ({ signal, input }) {
					const { controlId, options } = input
					const id = nanoid()

					try {
						if (self.#buttonReferencePreviews.get(id)) throw new Error('Session id is already in use')

						// Start wathing for changes to the reference
						const changes = toIterable(self.#renderEvents, `reference:${id}`, signal)

						const location = self.#pageStore.getLocationOfControlId(controlId)
						const parser = self.#controlsController.createVariablesAndExpressionParser(controlId, null)

						// Do a resolve of the reference for the starting image
						const locationValue = parser.parseEntityOption(options.location, {
							allowExpression: true,
							parseVariables: true,
						})
						const resolvedLocation = ParseLocationString(stringifyVariableValue(locationValue.value), location)

						// Track the subscription, to allow it to be invalidated
						self.#buttonReferencePreviews.set(id, {
							id,
							controlId,
							options,
							resolvedLocation: resolvedLocation,
							referencedVariableIds: locationValue.referencedVariableIds,
						})

						// Emit the initial image
						yield resolvedLocation
							? await self.#graphicsController.getCachedRenderOrGeneratePlaceholder(resolvedLocation).drawDataUrl()
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
		const controlId = this.#pageStore.getControlIdAt(location)
		this.#updateButtonQueue.queue(getLocationSubId(location), location, controlId, render)
	}

	onControlIdsLocationChanged(controlIds: string[]): void {
		const controlIdsSet = new Set(controlIds)

		// Lookup any sessions
		for (const previewSession of this.#buttonReferencePreviews.values()) {
			if (!controlIdsSet.has(previewSession.controlId)) continue

			// Recheck the reference
			this.#triggerRecheck(previewSession)
		}
	}

	onVariablesChanged(allChangedSet: ReadonlySet<string>, fromControlId: string | null): void {
		// Lookup any sessions
		for (const previewSession of this.#buttonReferencePreviews.values()) {
			if (!previewSession.referencedVariableIds || !previewSession.referencedVariableIds.size) continue

			// If the changed variables belong to a control, only update if the query is for that control
			if (fromControlId && previewSession.controlId != fromControlId) continue

			if (previewSession.referencedVariableIds.isDisjointFrom(allChangedSet)) continue

			// Recheck the reference
			this.#triggerRecheck(previewSession)
		}
	}

	#triggerRecheck(previewSession: PreviewSession): void {
		try {
			const location = this.#pageStore.getLocationOfControlId(previewSession.controlId)
			const parser = this.#controlsController.createVariablesAndExpressionParser(previewSession.controlId, null)

			// Resolve the new location
			const locationValue = parser.parseEntityOption(previewSession.options.location, {
				allowExpression: true,
				parseVariables: true,
			})
			const resolvedLocation = ParseLocationString(stringifyVariableValue(locationValue.value), location)

			const lastResolvedLocation = previewSession.resolvedLocation

			previewSession.referencedVariableIds = locationValue.referencedVariableIds
			previewSession.resolvedLocation = resolvedLocation

			if (!resolvedLocation) {
				// Now has an invalid location
				this.#renderEvents.emit(`reference:${previewSession.id}`, null)
				return
			}

			// Check if it has changed
			if (
				lastResolvedLocation &&
				resolvedLocation.pageNumber == lastResolvedLocation.pageNumber &&
				resolvedLocation.row == lastResolvedLocation.row &&
				resolvedLocation.column == lastResolvedLocation.column
			)
				return

			this.#recheckQueue.queue(previewSession.id, previewSession.id, resolvedLocation)
		} catch (e) {
			this.#logger.error(`Error while rechecking preview session for control ${previewSession.controlId}: ${e}`)
		}
	}
}

interface PreviewSession {
	readonly id: string
	readonly controlId: string
	options: ExpressionableOptionsObject
	resolvedLocation: ControlLocation | null
	referencedVariableIds: ReadonlySet<string>
}
