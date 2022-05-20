import ButtonControlBase from './ButtonBase.js'
import Registry from '../Registry.js'

export default class PageNumberButtonControl extends ButtonControlBase {
	type = 'pagenum'

	constructor(registry, controlId, storage) {
		super(registry, controlId, 'page-button', 'Controls/PageNumberButton')

		if (!storage) {
			// New control

			// Save the change
			this.commitChange()
		} else {
			if (storage.type !== 'pagenum')
				throw new Error(`Invalid type given to PageNumberButtonControl: "${storage.type}"`)
		}
	}
	//

	toJSON() {
		return {
			type: this.type,
		}
	}
}
