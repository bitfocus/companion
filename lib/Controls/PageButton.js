import ButtonControlBase from './ButtonBase.js'
import Registry from '../Registry.js'

export default class PageButtonControl extends ButtonControlBase {
	constructor(registry, controlId, storage) {
		super(registry, controlId, 'page-button', 'Controls/PageButton')

		if (storage.type !== 'pagenum' && storage.type !== 'pageup' && storage.type !== 'pagedown')
			throw new Error(`Invalid type given to PageButtonControl: "${storage.type}"`)

		this.type = storage.type
	}
	//

	toJSON() {
		return {
			type: this.type,
		}
	}
}
