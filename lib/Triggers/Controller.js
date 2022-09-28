import { nanoid } from 'nanoid'
import { cloneDeep } from 'lodash-es'
import CoreBase from '../Core/Base.js'
import Plugins from './Plugin/index.js'
import jsonPatch from 'fast-json-patch'
import { CreateTriggerControlId } from '../Resources/Util.js'

function sanitize_export(raw_conf) {
	const conf = cloneDeep(raw_conf)
	delete conf.config_desc
	delete conf.last_run
	delete conf.id

	return conf
}

class TriggersController extends CoreBase {
	constructor(registry) {
		super(registry, 'triggers', 'Triggers/Controller')

		this.btn_release_time = 20
		this.config = {}
		this.plugins = []

		this.load_plugins()
	}

	getAllActions() {
		const all_actions = []
		for (const event of Object.values(this.config)) {
			if (Array.isArray(event.actions)) {
				all_actions.push(
					...event.actions.map((a) => ({
						...a,
						triggerId: event.id,
					}))
				)
			}
		}
		return all_actions
	}

	getAllFeedbacks() {
		// Note: This is a hack, that will be tidied by implementing https://github.com/bitfocus/companion/issues/1908#issuecomment-1038888163
		for (const plugin of this.plugins) {
			// Assume that only one plugin implements this..
			if (typeof plugin.getAllFeedbacks === 'function') {
				return plugin.getAllFeedbacks()
			}
		}
		return []
	}

	updateFeedbackValues(valuesForTriggers, instanceId) {
		// Note: This is a hack, that will be tidied by implementing https://github.com/bitfocus/companion/issues/1908#issuecomment-1038888163
		for (const plugin of this.plugins) {
			if (typeof plugin.updateFeedbackValues === 'function') {
				plugin.updateFeedbackValues(valuesForTriggers, instanceId)
			}
		}
	}

	replaceActionItem(id, newProps) {
		const event = this.config[id]

		if (event) {
			for (const action of event.actions) {
				if (action.id === newProps.id) {
					action.action = newProps.actionId
					action.options = newProps.options

					delete action.upgradeIndex

					return true
				}
			}
		}

		return false
	}
	replaceFeedbackItem(id, newProps) {
		// Note: This is a hack, that will be tidied by implementing https://github.com/bitfocus/companion/issues/1908#issuecomment-1038888163
		for (const plugin of this.plugins) {
			if (typeof plugin.replaceFeedbackItem === 'function') {
				// Assume that only one plugin implements this..
				return plugin.replaceFeedbackItem(id, newProps)
			}
		}

		return false
	}

	exportSingle(id) {
		const item = this.config[id]
		if (item) {
			return sanitize_export(item)
		} else {
			return undefined
		}
	}

	exportAll() {
		return Object.values(this.config).map((x) => sanitize_export(x))
	}

	/**
	 * Clear any existing triggers
	 */
	reset() {
		// execute the stop
		for (const event of Object.values(this.config)) {
			this.event_watch(event, false)
		}

		const oldConfig = this.config

		this.config = {}

		this.emit('list_refresh', this.config)

		const patch = jsonPatch.compare(oldConfig || {}, this.config || {})
		if (patch.length > 0) {
			this.io.emit('schedule:update', patch)
		}

		this.doSave()
	}

	/**
	 * Setup a new socket client's events
	 * @param {SocketIO} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		client.on('schedule_get', this.get_schedule.bind(this, client))
		client.on('schedule_save_item', this.save_schedule.bind(this, client))
		client.on('schedule_update_item', this.update_schedule.bind(this, client))
		client.on('schedule_clone_item', this.clone_schedule.bind(this, client))
		client.on('schedule_plugins', this.send_plugins.bind(this, client))
		client.on('schedule_test_actions', this.test_actions.bind(this, client))

		if (this.plugins) {
			for (const id in this.plugins) {
				const plugin = this.plugins[id]
				if (plugin && typeof plugin.clientConnect === 'function') {
					plugin.clientConnect(client)
				}
			}
		}
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
	 *
	 * @param {SocketIO} socket
	 * @param {pluginCallback} cb
	 */
	send_plugins(socket, cb) {
		/**
		 * @callback pluginCallback
		 * @param {Object[]}
		 */
		cb(this.plugins.map((p) => p.front_end()))
	}

	/**
	 * Loads plugins from the schedule plugin directory
	 */
	load_plugins() {
		for (const plugin of Plugins) {
			try {
				this.plugins.push(new plugin(this))
			} catch (e) {
				this.logger.silly(e)
				this.logger.error(`Error loading plugin ${p}`)
			}
		}
	}

	/**
	 * Initialize the configuration and start any schedules
	 */
	init_config() {
		this.config = this.db.getKey('scheduler', {})

		if (!this.config) {
			this.config = {}
			this.doSave()
		}

		this.start_schedule()
	}

	get_trigger(id) {
		return this.config[id]
	}

	/**
	 * Starts all event schedules
	 */
	start_schedule() {
		for (const conf of Object.values(this.config)) {
			this.event_watch(conf)
		}
	}

	/**
	 * Gets the plugin from a request type
	 * @param {string} type
	 * @return {?Object}
	 */
	get_plugin(type) {
		let plugin = this.plugins.find((p) => p.type === type)
		if (!plugin) {
			this.logger.error('Plugin not loaded.')
			return null
		}
		return plugin
	}

	/**
	 * Register or unregister an event from being watched
	 * @param {Object} config
	 * @param {boolean} add Add or remove the event from the watch schedule
	 */
	event_watch(config, add = true) {
		let plugin = this.get_plugin(config.type)
		if (!plugin) {
			return
		}

		if (!add) {
			this.logger.info('Removing scheduled event.')
			plugin.remove(config.id)
		} else if (config.disabled === false) {
			this.logger.info('Adding scheduled event.')
			plugin.add(config.id, config)
		}
	}

	/**
	 * Cleans the configuration to store in the database
	 * @param {Object} config
	 * @return {Object}
	 */
	clean_config(config) {
		const clean_config = Object.assign(
			{
				title: '',
				type: null,
				config: {},
				last_run: null,
				disabled: false,
			},
			config
		)

		if (!('id' in clean_config) || clean_config.id === null) {
			clean_config.id = this._get_next_id()
		}

		if (!Array.isArray(clean_config.actions)) {
			clean_config.actions = []
		}

		return clean_config
	}

	/**
	 * Get the next unique event ID
	 * @return {number}
	 */
	_get_next_id() {
		if (Object.keys(this.config).length === 0) {
			return 1
		}

		const cur_max_id = Math.max.apply(Math, Object.keys(this.config))
		if (cur_max_id <= 0 || isNaN(cur_max_id)) {
			this.loggger.warn('Configuration appears to be corrupt.')
			this.logger.silly(
				'current max id is invalid; this may be a bug or a corruption that may require a reset of the scheduler config'
			)
			return 1
		} else {
			return cur_max_id + 1
		}
	}

	/**
	 * Loads plugin based parameters
	 * These parameters are dynamic and aren't stored to the database, but are
	 * needed for the front end. For example, the configuration description.
	 * @param {Object} event
	 * @return {Object} Event object with plugin passed params
	 */
	event_load_type(event) {
		const plugin = this.get_plugin(event.type)
		if (!plugin) {
			this.logger.error(`Could not load plugin type ${event.type}.`)
			event.config_desc = 'Unknown schedule type.'
		} else {
			event.config_desc = plugin.config_desc(event.config)
		}

		return event
	}

	/**
	 * Sends the event list to the callback
	 * @param {SocketIO} socket
	 * @param {scheduleGetCb} cb
	 */
	get_schedule(socket, cb) {
		const res = {}
		for (const [id, event] of Object.entries(this.config)) {
			res[id] = this.event_load_type(event)
		}
		cb(res)
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

	/**
	 * Updates a schedule
	 * Minor updates and deletions
	 * @param {SocketIO} socket
	 * @param {number} id Event ID
	 * @param {Object} new_data If deleted property is set, event is deleted
	 */
	update_schedule(socket, id, new_data) {
		let event = this.config[id]
		if (!event) {
			this.logger.error('Scheduled event could not be found.')
			return
		}

		const oldConfig = { ...this.config }

		// Stop watching old event
		this.event_watch(event, false)

		if ('deleted' in new_data) {
			delete this.config[id]
		} else {
			event = { ...event, ...new_data }
			this.config[id] = event
			this.event_load_type(event)
			this.event_watch(event)
		}

		this.doSave()

		this.emit('list_refresh', this.config)

		const patch = jsonPatch.compare(oldConfig || {}, this.config || {})
		if (patch.length > 0) {
			this.io.emit('schedule:update', patch)
		}
	}

	/**
	 * Sets whether an event is enabled or disabled
	 * @param {number} id Event ID
	 * @param {Object} enabled Whether the event should be enabled
	 */
	set_enabled(id, enabled) {
		const event = this.config[id]
		if (!event) {
			return
		}

		// Stop watching old event
		this.event_watch(event, false)

		const oldConfig = {
			...this.config,
			[id]: { ...event },
		}

		event.disabled = !enabled
		this.event_watch(event)

		this.doSave()

		this.emit('list_refresh', this.config)

		const patch = jsonPatch.compare(oldConfig || {}, this.config || {})
		if (patch.length > 0) {
			this.io.emit('schedule:update', patch)
		}
	}

	clone_schedule(socket, id) {
		const existing_item = this.config[id]
		if (!existing_item) {
			this.logger.error('Scheduled event could not be found.')
			return
		}

		const plugin = this.get_plugin(existing_item.type)
		if (!plugin) {
			return
		}

		const oldConfig = { ...this.config }

		// clone the item
		const new_item = plugin.clone(existing_item)
		new_item.id = this._get_next_id()
		delete new_item.last_run
		this.config[new_item.id] = new_item

		this.doSave()
		this.event_watch(new_item)

		this.event_load_type(new_item)

		this.emit('list_refresh', this.config)

		const patch = jsonPatch.compare(oldConfig || {}, this.config || {})
		if (patch.length > 0) {
			this.io.emit('schedule:update', patch)
		}
	}

	/**
	 * Replaced an event configuration
	 * @param {SocketIO} socket
	 * @param {Object} new_data
	 */
	save_schedule(socket, new_data) {
		const clean_data = this.clean_config(new_data)
		const id = clean_data.id

		if (this.config[id]) {
			// Keep the last run and disabled status from the old config
			clean_data.last_run = this.config[id].last_run
			clean_data.disabled = this.config[id].disabled
		}

		const oldConfig = { ...this.config }

		this.config[id] = clean_data

		this.event_watch(this.config[id], false)

		this.doSave()

		this.event_watch(clean_data)

		this.event_load_type(clean_data)

		this.emit('list_refresh', this.config)

		const patch = jsonPatch.compare(oldConfig || {}, this.config || {})
		if (patch.length > 0) {
			this.io.emit('schedule:update', patch)
		}
	}

	/**
	 * Saves to database
	 */
	doSave() {
		this.db.setKey('scheduler', this.config)
	}
}

export default TriggersController
