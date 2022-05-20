import ButtonControlBase from './ButtonBase.js'
import Registry from '../Registry.js'

export default class PageDownButtonControl extends ButtonControlBase {
	type = 'pagedown'

	constructor(registry, controlId, storage) {
		super(registry, controlId, 'page-button', 'Controls/PageDownButton')

		if (!storage) {
			// New control

			// Save the change
			this.commitChange()
		} else {
			if (storage.type !== 'pagedown') throw new Error(`Invalid type given to PageDownButtonControl: "${storage.type}"`)
		}
	}
	//

	toJSON() {
		return {
			type: this.type,
		}
	}
}
