import { cloneDeep } from 'lodash-es'
import { nanoid } from 'nanoid'
import CoreBase from '../Core/Base.js'
import Registry from '../Registry.js'

/**
 * The class that manages the bank actions
 *
 * @extends CoreBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 1.0.4
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

class BankAction extends CoreBase {
	bank_set_step_change(page, bank, value) {
		// // notify internal module
		// const index = Object.keys(this.bank_action_sets[page][bank]).indexOf(value)
		// this.system.emit('bank_action_sets_step', page, bank, index === -1 ? 0 : index)
		// TODO
	}
}

export default BankAction
