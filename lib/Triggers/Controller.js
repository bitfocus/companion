import { nanoid } from 'nanoid'
import { cloneDeep } from 'lodash-es'
import CoreBase from '../Core/Base.js'
import Plugins from './Plugin/index.js'
import jsonPatch from 'fast-json-patch'
import { CreateTriggerControlId } from '../Resources/Util.js'

class TriggersController extends CoreBase {
	constructor(registry) {
		super(registry, 'triggers', 'Triggers/Controller')

		this.btn_release_time = 20
		this.config = {}
		this.plugins = []

		this.load_plugins()
	}

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

	/**
	 * Call an action
	 * This method is called from within a plugin and sends the id, the scheduler determines what should then happen
	 * @param {number} id
	 */
	action(id) {
		const event = this.config[id]
		if (!event) {
			this.logger.error('Could not find configuration for action.')
			return
		}

		this.logger.info(`Execute ${event.title}`)

		if (event.actions) {
			this.controls.actions.runMultipleActions(
				event.actions,
				CreateTriggerControlId(id),
				event.relative_delays ?? false,
				null
			)
		}

		// Update the last run
		event.last_run = new Date()
		this.doSave()

		if (this.io) {
			this.io.emit('schedule_last_run', id, event.last_run)
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
