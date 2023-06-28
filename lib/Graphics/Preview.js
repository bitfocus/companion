import CoreBase from '../Core/Base.js'
import Registry from '../Registry.js'
import { ControlConfigRoom } from '../Controls/ControlBase.js'
import { ParseInternalControlReference } from '../Internal/Util.js'

function PreviewPageRoom(page) {
	return `preview:page:${page}`
}

/**
 * The class that manages bank preview generation/relay for interfaces
 *
 * @extends CoreBase
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
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 */
class GraphicsPreview extends CoreBase {
	/**
	 * Current bank reference previews
	 */
	#bankReferencePreviews = new Map()

	/**
	 * @param {Registry} registry - the application core
	 */
	constructor(registry) {
		super(registry, 'preview', 'Graphics/Preview')

		this.graphics.on('button_drawn', this.updateButton.bind(this))
	}

	/**
	 * Setup a client's calls
	 * @param {Socket} client - the client connection
	 * @access public
	 */
	clientConnect(client) {
		client.onPromise('preview:page:subscribe', (page) => {
			client.join(PreviewPageRoom(page))

			const renders = {}
			for (let y = 0; y < global.MAX_BUTTONS_PER_COL; ++y) {
				const rowRenders = (renders[y] = {})
				for (let x = 0; x < global.MAX_BUTTONS_PER_ROW; ++x) {
					rowRenders[x]
					rowRenders[x] = this.graphics.getBank({
						pageNumber: page,
						column: x,
						row: y,
					}).buffer
				}
			}

			return renders
		})
		client.onPromise('preview:page:unsubscribe', (pageNumber) => {
			client.leave(PreviewPageRoom(pageNumber))
		})

		client.onPromise('preview:button-reference:subscribe', (id, location, options) => {
			const fullId = `${client.id}::${id}`

			if (this.#bankReferencePreviews.get(fullId)) throw new Error('Session id is already in use')

			// Do a resolve of the reference for the starting image
			const result = ParseInternalControlReference(this, location, options, true)

			// Track the subscription, to allow it to be invalidated
			this.#bankReferencePreviews.set(fullId, {
				id,
				location,
				options,
				resolvedLocation: result.location,
				referencedVariableIds: new Set(result.referencedVariables),
				client,
			})

			return result.location ? this.graphics.getBank(result.location).buffer : null
		})
		client.onPromise('preview:button-reference:unsubscribe', (id) => {
			const fullId = `${client.id}::${id}`

			this.#bankReferencePreviews.delete(fullId)
		})
	}

	/**
	 * Send a bank update to the UIs
	 * @param {*} location
	 * @param {*} render
	 * @access public
	 */
	updateButton(location, render) {
		// Push the updated render to any clients viewing a preview of a control
		const controlId = this.page.getControlIdAt(location)
		if (controlId) {
			const controlRoom = ControlConfigRoom(controlId)
			if (this.io.countRoomMembers(controlRoom) > 0) {
				this.io.emitToRoom(controlRoom, `controls:preview-${controlId}`, render.buffer)
			}
		}

		const previewRoom = PreviewPageRoom(location.pageNumber)
		if (this.io.countRoomMembers(previewRoom) > 0) {
			this.io.emitToRoom(previewRoom, `preview:page-bank`, location, render.buffer)
		}

		// Lookup any sessions
		for (const previewSession of this.#bankReferencePreviews.values()) {
			if (!previewSession.resolvedLocation) continue
			if (previewSession.resolvedLocation.pageNumber != location.pageNumber) continue
			if (previewSession.resolvedLocation.row != location.row) continue
			if (previewSession.resolvedLocation.column != location.column) continue

			previewSession.client.emit(`preview:button-reference:update:${previewSession.id}`, render.buffer)
		}
	}

	onVariablesChanged(changedVariables, removedVariables) {
		const allChanged = [...Object.keys(changedVariables), ...removedVariables]

		// Lookup any sessions
		for (const previewSession of this.#bankReferencePreviews.values()) {
			if (!previewSession.referencedVariableIds || previewSession.referencedVariableIds.length == 0) continue

			const matchingChangedVariable = allChanged.some((variable) => previewSession.referencedVariableIds.has(variable))
			if (!matchingChangedVariable) continue

			// Resolve the new location
			const result = ParseInternalControlReference(this, previewSession.location, previewSession.options, true)

			const lastResolvedLocation = previewSession.resolvedLocation

			previewSession.referencedVariableIds = new Set(result.referencedVariables)
			previewSession.resolvedLocation = result.location

			if (!result.location) {
				// Now has an invalid location
				previewSession.client.emit(`preview:button-reference:update:${previewSession.id}`, null)
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

			previewSession.client.emit(
				`preview:button-reference:update:${previewSession.id}`,
				this.graphics.getBank(result.location).buffer
			)
		}
	}
}

export default GraphicsPreview
