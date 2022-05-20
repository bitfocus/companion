import { cloneDeep } from 'lodash-es'
import CoreBase from '../Core/Base.js'
import Registry from '../Registry.js'
import jsonPatch from 'fast-json-patch'

export function ControlConfigRoom(controlId) {
	return `controls:${controlId}`
}

export default class ControlBase extends CoreBase {
	//
	#lastSentJson = null

	constructor(registry, controlId, logSource, debugNamespace) {
		super(registry, logSource, debugNamespace)

		this.controlId = controlId
	}

	pressBank(direction, deviceid) {
		// TODO
	}

	replaceFeedback(item) {
		// TODO
	}

	replaceAction(item) {
		// TODO
	}

	getBankCompleteStyle() {
		// TODO - dont use this..
	}

	toJSON() {
		// TODO
		return {}
	}

	commitChange() {
		// Trigger redraw
		// TODO

		// Save to db
		// TODO

		// Now broadcast to any interested clients
		const roomName = ControlConfigRoom(this.controlId)
		const newJson = cloneDeep(this.toJSON())

		if (this.io.countRoomMembers(roomName) > 0) {
			const patch = jsonPatch.compare(this.#lastSentJson || {}, newJson || {})
			if (patch.length > 0) {
				this.io.emitToRoom(roomName, roomName, patch)
			}
		}

		this.#lastSentJson = newJson
	}
}
