import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { ControlConfigRoom } from '../Controls/ControlBase.js'
import { ParseInternalControlReference } from '../Internal/Util.js'
import LogController from '../Log/Controller.js'
import type { GraphicsController } from './Controller.js'
import type { UIHandler, ClientSocket } from '../UI/Handler.js'
import type { PageController } from '../Page/Controller.js'
import type { ImageResult } from './ImageResult.js'
import type { ControlsController } from '../Controls/Controller.js'

/**
 * Get Socket.io room for preview updates
 */
function PreviewLocationRoom(location: ControlLocation): string {
	return `preview:location:${location.pageNumber}:${location.row}:${location.column}`
}

/**
 * Ensure a location is correctly formed as numbers
 */
function ensureLocationIsNumber(location: ControlLocation): ControlLocation {
	return {
		pageNumber: Number(location.pageNumber),
		row: Number(location.row),
		column: Number(location.column),
	}
}

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
	readonly #ioController: UIHandler
	readonly #pageController: PageController
	readonly #controlsController: ControlsController

	readonly #buttonReferencePreviews = new Map<string, PreviewSession>()

	constructor(
		graphicsController: GraphicsController,
		ioController: UIHandler,
		pageController: PageController,
		controlsController: ControlsController
	) {
		this.#graphicsController = graphicsController
		this.#ioController = ioController
		this.#pageController = pageController
		this.#controlsController = controlsController

		this.#graphicsController.on('button_drawn', this.#updateButton.bind(this))
	}

	/**
	 * Setup a client's calls
	 */
	clientConnect(client: ClientSocket) {
		const locationSubsForClient = new Map<string, Set<string>>()
		const getLocationSubId = (location: ControlLocation): string =>
			`${location.pageNumber}_${location.row}_${location.column}`

		client.onPromise('preview:location:subscribe', (location, subId) => {
			if (!location || !subId) throw new Error('Invalid')

			location = ensureLocationIsNumber(location)

			const locationId = getLocationSubId(location)
			let entry = locationSubsForClient.get(locationId)
			if (!entry) {
				locationSubsForClient.set(locationId, (entry = new Set()))
			}
			entry.add(subId)

			client.join(PreviewLocationRoom(location))

			const render = this.#graphicsController.getCachedRenderOrGeneratePlaceholder(location)
			return { image: render.asDataUrl, isUsed: !!render.style }
		})
		client.onPromise('preview:location:unsubscribe', (location, subId) => {
			if (!location || !subId) throw new Error('Invalid')

			location = ensureLocationIsNumber(location)

			const locationId = getLocationSubId(location)
			const entry = locationSubsForClient.get(locationId)
			if (!entry) return

			entry.delete(subId)
			if (entry.size === 0) {
				locationSubsForClient.delete(locationId)

				client.leave(PreviewLocationRoom(location))
			}
		})

		client.onPromise('preview:button-reference:subscribe', (id, controlId, options) => {
			const fullId = `${client.id}::${id}`

			if (this.#buttonReferencePreviews.get(fullId)) throw new Error('Session id is already in use')

			const location = this.#pageController.getLocationOfControlId(controlId)
			const parser = this.#controlsController.createVariablesAndExpressionParser(location, null)

			// Do a resolve of the reference for the starting image
			const result = ParseInternalControlReference(this.#logger, parser, location, options, true)

			// Track the subscription, to allow it to be invalidated
			this.#buttonReferencePreviews.set(fullId, {
				id,
				controlId,
				options,
				resolvedLocation: result.location,
				referencedVariableIds: Array.from(result.referencedVariables),
				client,
			})

			return result.location
				? this.#graphicsController.getCachedRenderOrGeneratePlaceholder(result.location).asDataUrl
				: null
		})
		client.onPromise('preview:button-reference:unsubscribe', (id) => {
			const fullId = `${client.id}::${id}`

			this.#buttonReferencePreviews.delete(fullId)
		})
	}

	/**
	 * Send a button update to the UIs
	 */
	#updateButton(location: ControlLocation, render: ImageResult): void {
		// Push the updated render to any clients viewing a preview of a control
		const controlId = this.#pageController.getControlIdAt(location)
		if (controlId) {
			const controlRoom = ControlConfigRoom(controlId)
			if (this.#ioController.countRoomMembers(controlRoom) > 0) {
				this.#ioController.emitToRoom(controlRoom, `controls:preview-${controlId}`, render.asDataUrl)
			}
		}

		const locationRoom = PreviewLocationRoom(location)
		if (this.#ioController.countRoomMembers(locationRoom) > 0) {
			this.#ioController.emitToRoom(locationRoom, `preview:location:render`, location, render.asDataUrl, !!render.style)
		}

		// Lookup any sessions
		for (const previewSession of this.#buttonReferencePreviews.values()) {
			if (!previewSession.resolvedLocation) continue
			if (previewSession.resolvedLocation.pageNumber != location.pageNumber) continue
			if (previewSession.resolvedLocation.row != location.row) continue
			if (previewSession.resolvedLocation.column != location.column) continue

			previewSession.client.emit(`preview:button-reference:update:${previewSession.id}`, render.asDataUrl)
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

	onVariablesChanged(allChangedSet: Set<string>, fromControlId: string | null): void {
		// Lookup any sessions
		for (const previewSession of this.#buttonReferencePreviews.values()) {
			if (!previewSession.referencedVariableIds || !previewSession.referencedVariableIds.length) continue

			// If the changed variables belong to a control, only update if the query is for that control
			if (fromControlId && previewSession.controlId != fromControlId) continue

			const matchingChangedVariable = previewSession.referencedVariableIds.some((variable) =>
				allChangedSet.has(variable)
			)
			if (!matchingChangedVariable) continue

			// Recheck the reference
			this.#triggerRecheck(previewSession)
		}
	}

	#triggerRecheck(previewSession: PreviewSession): void {
		const location = this.#pageController.getLocationOfControlId(previewSession.controlId)
		const parser = this.#controlsController.createVariablesAndExpressionParser(location, null)

		// Resolve the new location
		const result = ParseInternalControlReference(this.#logger, parser, location, previewSession.options, true)

		const lastResolvedLocation = previewSession.resolvedLocation

		previewSession.referencedVariableIds = Array.from(result.referencedVariables)
		previewSession.resolvedLocation = result.location

		if (!result.location) {
			// Now has an invalid location
			previewSession.client.emit(`preview:button-reference:update:${previewSession.id}`, null)
			return
		}

		// Check if it has changed
		if (
			lastResolvedLocation &&
			result.location.pageNumber == lastResolvedLocation.pageNumber &&
			result.location.row == lastResolvedLocation.row &&
			result.location.column == lastResolvedLocation.column
		)
			return

		previewSession.client.emit(
			`preview:button-reference:update:${previewSession.id}`,
			this.#graphicsController.getCachedRenderOrGeneratePlaceholder(result.location).asDataUrl
		)
	}
}

interface PreviewSession {
	readonly id: string
	readonly controlId: string
	options: Record<string, any>
	resolvedLocation: ControlLocation | null
	referencedVariableIds: string[]
	readonly client: ClientSocket
}
