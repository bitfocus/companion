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

const DataStoreBase = require('./StoreBase')
const fs = require('fs-extra')

/**
 * The class that manages the applications's config database
 *
 * @extends DataStoreBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @since 2.2.0
 */
class Config extends DataStoreBase {
	/**
	 * The default minimum interval in ms to save to disk (4000 ms)
	 * @type {number}
	 * @static
	 * @final
	 */
	static SaveInterval = 5000

	/**
	 * The debugger for this class
	 * @type {debug.Debugger}
	 * @access protected
	 */
	debug = require('debug')('lib/Data/Config')

	/**
	 * Create a new config flat file DB controller
	 * @param {EventEmitter} system - the application's event emitter
	 * @param {string} cfgDir - the directory the flat file will be saved
	 * @param {Object[]} defaults - the default data to use when making a new file
	 */
	constructor(system, cfgDir, defaults) {
		super(system, 'config', cfgDir, Config.SaveInterval, defaults)

		/**
		 * Callback for the `config_object` call
		 * @callback System~config_object-callback
		 * @param {Object.<string,(boolean|number|string)>} config - the key/value pairs
		 */
		/**
		 * Retrieve the config database
		 * @event System~config_object
		 * @param {System~config_object-callback} cb - the callback function to accept the object
		 */
		system.on('config_object', (cb) => {
			cb(this.getAll())
		})

		/**
		 * Callback for the `config_get` call
		 * @callback System~config_get-callback
		 * @param {(boolean|number|string)} value - the value pairs
		 */
		/**
		 * Retrieve a value from the config database
		 * @event System~config_get
		 * @param {string} key - the key to retrieve
		 * @param {System~config_get-callback} cb - the callback function to accept the value
		 */
		system.on('config_get', (key, cb) => {
			cb(this.getKey(key))
		})

		/**
		 * Save/update a key/value pair to the database
		 * @event System~config_set
		 * @param {(number|string)} key - the key to save under
		 * @param {(boolean|number|string)} value - the object to save
		 */
		system.on('config_set', this.setKey.bind(this))

		if (!fs.existsSync(this.cfgDir)) {
			this.debug('no config dir exists. creating:', this.cfgDir)
			fs.mkdirSync(this.cfgDir)
		}

		this.load()
	}
}

module.exports = exports = function (system, cfgDir, defaults) {
	return new Config(system, cfgDir, defaults)
}
