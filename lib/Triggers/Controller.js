import { nanoid } from 'nanoid'
import { cloneDeep } from 'lodash-es'
import CoreBase from '../Core/Base.js'
import Plugins from './Plugin/index.js'
import jsonPatch from 'fast-json-patch'
import { CreateTriggerControlId } from '../Resources/Util.js'

class TriggersController extends CoreBase {
	/**
	 * Do something when a bank is pressed
	 * @access public
	 */
	onBankPress(page, bank, direction, deviceid) {
		if (this.plugins) {
			for (const id in this.plugins) {
				const plugin = this.plugins[id]
				if (plugin && typeof plugin.onBankPress === 'function') {
					plugin.onBankPress(page, bank, direction, deviceid)
				}
			}
		}
	}

	/**
	 * Indicate the system is ready for processing
	 * @access public
	 */
	onSystemReady() {
		if (this.plugins) {
			for (const id in this.plugins) {
				const plugin = this.plugins[id]
				if (plugin && typeof plugin.onSystemReady === 'function') {
					plugin.onSystemReady()
				}
			}
		}
	}

	test_actions(socket, title, actions, relative_delays) {
		this.logger.info(`Testing execution for ${title}`)

		this.controls.actions.runMultipleActions(
			actions,
			CreateTriggerControlId(`test:${nanoid()}`),
			relative_delays ?? false,
			null
		)
	}
}

export default TriggersController
