import type { ControlLocation, WrappedImage } from '@companion-app/shared/Model/Common.js'
import { ParseLocationString } from '../Internal/Util.js'
import type { ImageResult } from '../Graphics/ImageResult.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import z from 'zod'
import EventEmitter from 'node:events'
import { nanoid } from 'nanoid'
import type { GraphicsController } from '../Graphics/Controller.js'
import type { IPageStore } from '../Page/Store.js'
import type { ControlsController } from '../Controls/Controller.js'
import type { ControlCommonEvents } from '../Controls/ControlDependencies.js'
import { stringifyVariableValue } from '@companion-app/shared/Model/Variables.js'
import {
	ExpressionableOptionsObjectSchema,
	JsonValueSchema,
	type ExpressionableOptionsObject,
} from '@companion-app/shared/Model/Options.js'
import LogController from '../Log/Controller.js'

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
						yield initialRender?.asDataUrl ?? null

						for await (const [controlId, render] of changes) {
							if (controlId !== control.controlId) continue
							yield render?.asDataUrl ?? null
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
							? self.#graphicsController.getCachedRenderOrGeneratePlaceholder(resolvedLocation).asDataUrl
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

			this.#renderEvents.emit(
				`reference:${previewSession.id}`,
				this.#graphicsController.getCachedRenderOrGeneratePlaceholder(resolvedLocation).asDataUrl
			)
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
