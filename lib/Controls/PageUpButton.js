import Registry from '../Registry.js'
import ControlBase from './ControlBase.js'

export default class PageUpButtonControl extends ControlBase {
	type = 'pageup'

	constructor(registry, controlId, storage) {
		super(registry, controlId, 'page-button', 'Controls/PageUpButton')

		if (!storage) {
			// New control

			// Save the change
			this.commitChange()
		} else {
			if (storage.type !== 'pageup') throw new Error(`Invalid type given to PageUpButtonControl: "${storage.type}"`)
		}
	}
	//

	toJSON(clone = true) {
		return {
			type: this.type,
		}
	}
}
