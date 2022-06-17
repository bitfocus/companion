const fs = require('fs')
const shortid = require('shortid')
const debug = require('debug')('lib/schedule')
const _ = require('lodash')
const jsonPatch = require('fast-json-patch')

function sanitize_export(raw_conf) {
	const conf = _.cloneDeep(raw_conf)
	delete conf.config_desc
	delete conf.last_run
	delete conf.id

	return conf
}

class scheduler {
	/**
	 * @param {EventEmitter} _system
	 */
	constructor(_system) {
		/** @type {EventEmitter} */
		this.system = _system
		this.btn_release_time = 20
		this.config = {}
		this.plugins = []
		this.io = null

		this.load_plugins()

		this.system.emit('db_get', 'scheduler', this.init_config.bind(this))
		this.system.emit('io_get', (io) => {
			this.io = io

			this.system.on('io_connect', (socket) => {
				socket.on('schedule_get', this.get_schedule.bind(this, socket))
				socket.on('schedule_save_item', this.save_schedule.bind(this, socket))
				socket.on('schedule_update_item', this.update_schedule.bind(this, socket))
				socket.on('schedule_clone_item', this.clone_schedule.bind(this, socket))
				socket.on('schedule_plugins', this.send_plugins.bind(this, socket))
				socket.on('schedule_test_actions', this.test_actions.bind(this, socket))
			})
		})

		this.system.on('schedule_get', this.get_schedule_array.bind(this, null))

		this.system.on('schedule_set_enabled', this.set_enabled.bind(this))

		this.system.on('schedule_clear', () => {
			// execute the stop
			Object.values(this.config).forEach((i) => this.event_watch(i, false))

			const oldConfig = this.config
			this.config = {}

			this.system.emit('schedule_refresh', this.config)

			const patch = jsonPatch.compare(oldConfig || {}, this.config || {})
			if (patch.length > 0) {
				this.io.emit('schedule_refresh', patch)
			}

			this.save_to_db()
		})

		this.system.on('schedule_get_all_actions', (cb) => {
			const all_actions = []
			for (const event of Object.values(this.config)) {
				if (Array.isArray(event.actions)) {
					all_actions.push(...event.actions)
				}
			}
			cb(all_actions)
		})

		this.system.on('schedule_export_single', (id, cb) => {
			cb(sanitize_export(this.config[id]))
		})

		this.system.on('schedule_export_all', (cb) => {
			cb(Object.values(this.config).map((x) => sanitize_export(x)))
		})
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
		const path = require('app-root-path') + '/lib/schedule'
		const plugins_folder = fs.readdirSync(path)

		plugins_folder.forEach((p) => {
			if (p === 'plugin_base.js' || p.match(/\.js$/) === null) {
				return
			}

			try {
				const plugin = require(path + '/' + p)
				this.plugins.push(new plugin(this))
			} catch (e) {
				debug(e)
				this.system.emit('log', 'scheduler', 'error', `Error loading plugin ${p}`)
			}
		})
	}

	/**
	 * Initialize the configuration and start any schedules
	 * @param {?Object[]} res
	 */
	init_config(res) {
		if (res === undefined || res === null) {
			res = {}
		}

		if (Array.isArray(res)) {
			// Convert into an object
			const obj = {}
			for (const conf of res) {
				obj[conf.id] = conf
			}
			res = obj
		}

		// Do a save just to make sure it is formatted correctly
		this.save_to_db()

		this.config = res

		for (let entry of Object.values(this.config)) {
			// Convert variable type to feedback type
			if (entry.type === 'variable') {
				entry.type = 'feedback'

				const newConfig = []
				const oldConfig = Array.isArray(entry.config) ? entry.config : [entry.config]
				for (let conf of oldConfig) {
					let check = conf.check
					if (check == 'lt') check = 'gt'
					else if (check == 'gt') check = 'lt'

					newConfig.push({
						id: shortid(),
						type: 'variable_value',
						instance_id: 'bitfocus-companion',
						options: {
							variable: conf.key,
							op: check,
							value: conf.value,
						},
					})
				}
				entry.config = newConfig
			}

			// Convert button index to an action
			if (entry.button && !entry.actions) {
				const page = parseInt(entry.button)
				const bank = parseInt(entry.button.toString().replace(/(.*)\./, ''))
				entry.actions = [
					{
						id: shortid(),
						instance: 'bitfocus-companion',
						label: 'bitfocus-companion:button_pressrelease',
						action: 'button_pressrelease',
						options: {
							page: page,
							bank: bank,
						},
					},
				]

				delete entry.button
			}
		}

		this.start_schedule()
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
			this.system.emit('log', 'scheduler', 'error', 'Plugin not loaded.')
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
			this.system.emit('log', 'scheduler', 'info', 'Removing scheduled event.')
			plugin.remove(config.id)
		} else if (config.disabled === false) {
			this.system.emit('log', 'scheduler', 'info', 'Adding scheduled event.')
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

		if (Array.isArray(config.config) && config.config.length === 1) {
			clean_config.config = config.config[0]
		}

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
			debug(
				'current max id is invalid; this may be a bug or a corruption that may require a reset of the scheduler config'
			)
			this.system.emit('log', 'scheduler', 'warn', 'Configuration appears to be corrupt.')
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
			this.system.emit('log', 'scheduler', 'error', `Could not load plugin type ${event.type}.`)
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
	 * Sends the event list to the callback
	 * @param {SocketIO} socket
	 * @param {scheduleGetCb} cb
	 */
	get_schedule_array(socket, cb) {
		/**
		 * @callback scheduleGetCb
		 * @param {Object[]}
		 */
		cb(Object.values(this.config).map((i) => this.event_load_type(i)))
	}

	/**
	 * Call an action
	 * This method is called from within a plugin and sends the id, the scheduler determines what should then happen
	 * @param {number} id
	 */
	action(id) {
		const event = this.config[id]
		if (!event) {
			this.system.emit('log', 'scheduler', 'error', 'Could not find configuration for action.')
			return
		}

		this.system.emit('log', 'scheduler', 'info', `Execute ${event.title}`)

		if (event.actions) {
			const triggerId = `trigger:${id}`
			this.system.emit('action_run_multiple', event.actions, triggerId, event.relative_delays ?? false, null)
		}

		// Update the last run
		event.last_run = new Date()
		this.save_to_db()

		if (this.io) {
			this.io.emit('schedule_last_run', id, event.last_run)
		}
	}

	test_actions(socket, title, actions, relative_delays) {
		this.system.emit('log', 'scheduler', 'info', `Testing execution for ${title}`)

		const triggerId = `trigger:test:${shortid()}`
		this.system.emit('action_run_multiple', actions, triggerId, relative_delays ?? false, null)
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
			this.system.emit('log', 'scheduler', 'error', 'Scheduled event could not be found.')
			return
		}

		const oldConfig = { ...this.config }

		// Stop watching old event
		this.event_watch(event, false)

		/**
		 * @callback scheduleUpdateCb
		 * @param {?Object} event Will return null if event was deleted
		 */
		if ('deleted' in new_data) {
			delete this.config[id]
		} else {
			event = { ...event, ...new_data }
			this.config[id] = event
			this.event_load_type(event)
			this.event_watch(event)
		}

		this.save_to_db()

		this.system.emit('schedule_refresh', this.config)

		const patch = jsonPatch.compare(oldConfig || {}, this.config || {})
		if (patch.length > 0) {
			this.io.emit('schedule_refresh', patch)
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

		this.save_to_db()

		this.system.emit('schedule_refresh', this.config)

		const patch = jsonPatch.compare(oldConfig || {}, this.config || {})
		if (patch.length > 0) {
			this.io.emit('schedule_refresh', patch)
		}
	}

	clone_schedule(socket, id) {
		const existing_item = this.config[id]
		if (!existing_item) {
			this.system.emit('log', 'scheduler', 'error', 'Scheduled event could not be found.')
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

		this.save_to_db()
		this.event_watch(new_item)

		this.event_load_type(new_item)

		this.system.emit('schedule_refresh', this.config)

		const patch = jsonPatch.compare(oldConfig || {}, this.config || {})
		if (patch.length > 0) {
			this.io.emit('schedule_refresh', patch)
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

		this.save_to_db()
		this.event_watch(clean_data)

		this.event_load_type(clean_data)

		this.system.emit('schedule_refresh', this.config)

		const patch = jsonPatch.compare(oldConfig || {}, this.config || {})
		if (patch.length > 0) {
			this.io.emit('schedule_refresh', patch)
		}
	}

	/**
	 * Saves to database
	 */
	save_to_db() {
		this.system.emit('db_set', 'scheduler', Object.values(this.config))
		this.system.emit('db_save')
	}
}

module.exports = (system) => new scheduler(system)
