import ControlBase from './ControlBase.js'
import Registry from '../Registry.js'
import { rgb } from '../Resources/Util.js'

export default class ButtonControlBase extends ControlBase {
	/**
	 * The defaults for the bank fields
	 * @type {Object}
	 * @access public
	 * @static
	 */
	static DefaultFields = {
		text: '',
		size: 'auto',
		png: null,
		alignment: 'center:center',
		pngalignment: 'center:center',
		color: rgb(255, 255, 255),
		bgcolor: rgb(0, 0, 0),
		relative_delay: false,
	}

	//
}
