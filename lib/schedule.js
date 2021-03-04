const fs = require('fs')
const debug = require('debug')('lib/instance')

class scheduler {
	/**
	 * @param {EventEmitter} _system
	 */
	constructor(_system) {
		/** @type {EventEmitter} */
		this.system = _system
		this.btn_release_time = 20
		this.config = []
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
				socket.on('schedule_plugins', this.send_plugins.bind(this, socket))
			})
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
			res = []
			this.system.emit('db_set', 'scheduler', res)
		}

		this.config = res

		this.start_schedule()
	}

	/**
	 * Starts all event schedules
	 */
	start_schedule() {
		this.config.forEach((i) => this.event_watch(i))
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
	 * Get the bank and button number from a string
	 * @param {string} button
	 * @return {number[]}
	 */
	_get_bank_button(button) {
		const bank = parseInt(button)
		const button_number = parseInt(button.toString().replace(/(.*)\./, ''))

		return [bank, button_number]
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
				button: '1.1',
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

		clean_config.button = this._get_bank_button(clean_config.button).join('.')
		return clean_config
	}

	/**
	 * Get the next unique event ID
	 * @return {number}
	 */
	_get_next_id() {
		if (this.config.length === 0) {
			return 1
		}

		const cur_max_id = Math.max.apply(
			Math,
			this.config.map((i) => i.id)
		)
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
		/**
		 * @callback scheduleGetCb
		 * @param {Object[]}
		 */
		cb(this.config.map((i) => this.event_load_type(i)))
	}

	/**
	 * Get event index from an event ID
	 * @param {number} id
	 * @return {number}
	 */
	find_event_idx(id) {
		return this.config.findIndex((x) => x.id === id)
	}

	/**
	 * Call an action
	 * This method is called from within a plugin and sends the id, the scheduler determines what should then happen
	 * @param {number} id
	 */
	action(id) {
		const event = this.config.find((x) => x.id === id)
		if (!event) {
			this.system.emit('log', 'scheduler', 'error', 'Could not find configuration for action.')
			return
		}

		const [bank, button] = this._get_bank_button(event.button)

		this.system.emit('log', 'scheduler', 'info', `Push button ${bank}.${button} via <code>${event.title}</code>`)
		this.system.emit('bank_pressed', bank, button, true, 'scheduler')

		setTimeout(() => {
			this.system.emit('bank_pressed', bank, button, false, 'scheduler')
			this.system.emit('log', 'scheduler', 'info', `Release button ${bank}.${button} via <code>${event.title}</code>`)
		}, this.btn_release_time)

		// Update the last run
		event.last_run = new Date()
		this.save_to_db()

		if (this.io) {
			this.io.emit('schedule_refresh', this.config)
		}
	}

	/**
	 * Updates a schedule
	 * Minor updates and deletions
	 * @param {SocketIO} socket
	 * @param {number} id Event ID
	 * @param {Object} new_data If deleted property is set, event is deleted
	 * @param {scheduleUpdateCb} cb
	 */
	update_schedule(socket, id, new_data, cb) {
		const idx = this.find_event_idx(id)
		if (idx === -1) {
			this.system.emit('log', 'scheduler', 'error', 'Scheduled event could not be found.')
			return
		}

		// Stop watching old event
		this.event_watch(this.config[idx], false)

		/**
		 * @callback scheduleUpdateCb
		 * @param {?Object} event Will return null if event was deleted
		 */
		if ('deleted' in new_data) {
			this.config.splice(idx, 1)
			cb(null)
		} else {
			this.config[idx] = { ...this.config[idx], ...new_data }
			cb(this.event_load_type(this.config[idx]))
			this.event_watch(this.config[idx])
		}

		this.save_to_db()

		socket.broadcast.emit('schedule_refresh', this.config)
	}

	/**
	 * Replaced an event configuration
	 * @param {SocketIO} socket
	 * @param {Object} new_data
	 * @param {scheduleSaveCb} cb
	 */
	save_schedule(socket, new_data, cb) {
		const clean_data = this.clean_config(new_data)

		let idx = this.find_event_idx(clean_data.id)
		if (idx === -1) {
			this.config.push(clean_data)
		} else {
			// Keep the last run and disabled status from the old config
			clean_data.last_run = this.config[idx].last_run
			clean_data.disabled = this.config[idx].disabled

			this.event_watch(this.config[idx], false)
			this.config[idx] = clean_data
		}

		this.save_to_db()
		this.event_watch(clean_data)
		/**
		 * @callback scheduleSaveCb
		 * @param {Object} event Updated event
		 */
		cb(this.event_load_type(clean_data))

		socket.broadcast.emit('schedule_refresh', this.config)
	}

	/**
	 * Saves to database
	 */
	save_to_db() {
		this.system.emit('db_set', 'scheduler', this.config)
		this.system.emit('db_save')
	}
}

module.exports = (system) => new scheduler(system)
