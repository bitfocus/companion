/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 *
 */

const CoreBase = require('../Core/Base')
const fs = require('fs')

/**
 * The controller that handles all automation
 *
 * @extends CoreBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Justin Osborne <justin@eblah.com>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @since 2.2.0
 */
class ScheduleController extends CoreBase {
	/**
	 * The debugger for this class
	 * @type {debug.Debugger}
	 * @access protected
	 */
	debug = require('debug')('Schedule/Controller')

	/**
	 * @param {Registry} registry - the core registry
	 */
	constructor(registry) {
		super(registry, 'scheduler')

		this.btnReleaseTime = 20
		this.config = []
		this.plugins = []
		this.io = null

		this.loadPlugins()

		this.initConfig()

		this.system.on('io_connect', (client) => {
			client.on('schedule_get', this.getSchedule.bind(this, client))
			client.on('schedule_save_item', this.saveSchedule.bind(this, client))
			client.on('schedule_update_item', this.updateSchedule.bind(this, client))
			client.on('schedule_plugins', this.sendPlugins.bind(this, client))
		})
	}

	/**
	 * Call an action
	 * This method is called from within a plugin and sends the id, the scheduler determines what should then happen
	 * @param {number} id
	 */
	action(id) {
		const event = this.config.find((x) => x.id === id)

		if (!event) {
			this.log('error', 'Could not find configuration for action.')
			return
		}

		const [bank, button] = this.getBankButton(event.button)

		this.log('info', `Push button ${bank}.${button} via <code>${event.title}</code>`)
		this.system.emit('bank_pressed', bank, button, true, 'scheduler')

		setTimeout(() => {
			this.system.emit('bank_pressed', bank, button, false, 'scheduler')
			this.log('info', `Release button ${bank}.${button} via <code>${event.title}</code>`)
		}, this.btnReleaseTime)

		// Update the last run
		event.lastRun = new Date()
		this.saveToDb()

		if (this.io) {
			this.io.emit('schedule_refresh', this.config)
		}
	}

	/**
	 * Cleans the configuration to store in the database
	 * @param {Object} config
	 * @return {Object}
	 */
	cleanConfig(config) {
		const cleanConfig = Object.assign(
			{
				title: '',
				type: null,
				config: {},
				button: '1.1',
				lastRun: null,
				disabled: false,
			},
			config
		)

		if (Array.isArray(config.config) && config.config.length === 1) {
			cleanConfig.config = config.config[0]
		}

		if (!('id' in cleanConfig) || cleanConfig.id === null) {
			cleanConfig.id = this.getNextId()
		}

		cleanConfig.button = this.getBankButton(cleanConfig.button).join('.')
		return cleanConfig
	}

	/**
	 * Loads plugin based parameters
	 * These parameters are dynamic and aren't stored to the database, but are
	 * needed for the front end. For example, the configuration description.
	 * @param {Object} event
	 * @return {Object} Event object with plugin passed params
	 */
	eventLoadType(event) {
		const plugin = this.getPlugin(event.type)

		if (!plugin) {
			this.log('error', `Could not load plugin type ${event.type}.`)
			event.configDesc = 'Unknown schedule type.'
		} else {
			event.configDesc = plugin.configDesc(event.config)
		}

		return event
	}

	/**
	 * Register or unregister an event from being watched
	 * @param {Object} config
	 * @param {boolean} add Add or remove the event from the watch schedule
	 */
	eventWatch(config, add = true) {
		let plugin = this.getPlugin(config.type)

		if (!plugin) {
			return
		}

		if (!add) {
			this.log('info', 'Removing scheduled event.')
			plugin.remove(config.id)
		} else if (config.disabled === false) {
			this.log('info', 'Adding scheduled event.')
			plugin.add(config.id, config)
		}
	}

	/**
	 * Get event index from an event ID
	 * @param {number} id
	 * @return {number}
	 */
	findEventIndex(id) {
		return this.config.findIndex((x) => x.id === id)
	}

	/**
	 * Get the bank and button number from a string
	 * @param {string} button
	 * @return {number[]}
	 * @access protected
	 */
	getBankButton(button) {
		const bank = parseInt(button)
		const buttonNumber = parseInt(button.toString().replace(/(.*)\./, ''))

		return [bank, buttonNumber]
	}

	/**
	 * Get the next unique event ID
	 * @return {number}
	 * @access protected
	 */
	getNextId() {
		if (this.config.length === 0) {
			return 1
		}

		const curMaxId = Math.max.apply(
			Math,
			this.config.map((i) => i.id)
		)

		if (curMaxId <= 0 || isNaN(curMaxId)) {
			this.debug(
				'current max id is invalid; this may be a bug or a corruption that may require a reset of the scheduler config'
			)
			this.log('warn', 'Configuration appears to be corrupt.')
			return 1
		} else {
			return curMaxId + 1
		}
	}

	/**
	 * Gets the plugin from a request type
	 * @param {string} type
	 * @return {?Object}
	 */
	getPlugin(type) {
		let plugin = this.plugins.find((p) => p.type === type)

		if (!plugin) {
			this.log('error', 'Plugin not loaded.')
			return null
		}

		return plugin
	}

	/**
	 * Sends the event list to the callback
	 * @param {SocketIO} socket
	 * @param {ScheduleController~getSchedule-callback} cb
	 */
	getSchedule(socket, cb) {
		/**
		 * @callback ScheduleController~getSchedule-callback
		 * @param {Object[]}
		 */
		cb(this.config.map((i) => this.eventLoadType(i)))
	}

	/**
	 * Initialize the configuration and start any schedules
	 */
	initConfig() {
		this.config = this.db.getKey('scheduler', [])

		this.startSchedule()
	}

	/**
	 * Loads plugins from the schedule plugin directory
	 */
	loadPlugins() {
		const path = this.registry.appRoot + '/lib/Schedule/Plugin'
		const pluginsFolder = fs.readdirSync(path)

		pluginsFolder.forEach((p) => {
			if (p === 'base.js' || p.match(/\.js$/) === null) {
				return
			}

			try {
				const plugin = require(path + '/' + p)
				this.plugins.push(new plugin(this))
			} catch (e) {
				this.debug(e)
				this.log('error', `Error loading plugin ${p}`)
			}
		})
	}

	/**
	 * Replaced an event configuration
	 * @param {SocketIO} socket
	 * @param {Object} newData
	 * @param {ScheduleController~saveSchedule-callback} cb
	 */
	saveSchedule(socket, newData, cb) {
		const cleanData = this.cleanConfig(newData)

		let idx = this.findEventIndex(cleanData.id)

		if (idx === -1) {
			this.config.push(cleanData)
		} else {
			// Keep the last run and disabled status from the old config
			cleanData.lastRun = this.config[idx].lastRun
			cleanData.disabled = this.config[idx].disabled

			this.eventWatch(this.config[idx], false)
			this.config[idx] = cleanData
		}

		this.saveToDb()
		this.eventWatch(cleanData)
		/**
		 * @callback ScheduleController~saveSchedule-callback
		 * @param {Object} event Updated event
		 */
		cb(this.eventLoadType(cleanData))

		socket.broadcast.emit('schedule_refresh', this.config)
	}

	/**
	 * Saves to database
	 */
	saveToDb() {
		this.db.setKey('scheduler', this.config)
		//this.db.setDirty();
	}

	/**
	 *
	 * @param {SocketIO} socket
	 * @param {ScheduleController~sendPlugins-callback} cb
	 */
	sendPlugins(socket, cb) {
		/**
		 * @callback ScheduleController~sendPlugins-callback
		 * @param {Object[]}
		 */
		cb(this.plugins.map((p) => p.frontEnd()))
	}

	/**
	 * Starts all event schedules
	 */
	startSchedule() {
		this.config.forEach((i) => this.eventWatch(i))
	}

	/**
	 * Updates a schedule
	 * Minor updates and deletions
	 * @param {SocketIO} socket
	 * @param {number} id Event ID
	 * @param {Object} newData If deleted property is set, event is deleted
	 * @param {ScheduleController~updateSchedule-callback} cb
	 */
	updateSchedule(socket, id, newData, cb) {
		const idx = this.findEventIndex(id)

		if (idx === -1) {
			this.log('error', 'Scheduled event could not be found.')
			return
		}

		// Stop watching old event
		this.eventWatch(this.config[idx], false)

		/**
		 * @callback ScheduleController~updateSchedule-callback
		 * @param {?Object} event Will return null if event was deleted
		 */
		if ('deleted' in newData) {
			this.config.splice(idx, 1)
			cb(null)
		} else {
			this.config[idx] = { ...this.config[idx], ...newData }
			cb(this.eventLoadType(this.config[idx]))
			this.eventWatch(this.config[idx])
		}

		this.saveToDb()

		socket.broadcast.emit('schedule_refresh', this.config)
	}
}

exports = module.exports = ScheduleController
