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

var debug    = require('debug')('lib/Data/UserConfig');
var CoreBase = require('../Core/Base');
const { SendResult } = require('./resources/utils');

/**
 * The class that manages the applications's user configurable settings
 * 
 * @extends CoreBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @since 1.1.0
 */
class UserConfig extends CoreBase {

	/**
	 * Setup the user configuration handler and listeners
	 * @param {Registry} registry - the core registry
	 */
	constructor(registry) {
		super(registry, 'userconfig');

		this.userconfig = this.db().getKey('userconfig', UserConfig.Defaults);

		/**
		 * Callback for the `get_userconfig` call
		 * @callback System~get_userconfig-callback
		 * @param {Object.<string,(boolean|number|string)>} userconfig - the key/value pairs
		 */
		/**
		 * Retrieve the user config properties
		 * @event System~get_userconfig
		 * @param {System~get_userconfig-callback} cb - the callback function to accept the object
		 */
		this.system.on('get_userconfig', (cb) => {
			cb(this.userconfig);
		});

		this.system.on('io_connect', (client) => {

			/**
			 * Result broadcast for `set_userconfig_key` that pushes an updated user config key/value pair
			 * @event InterfaceClient~set_userconfig_key:result
			 * @param {string} key - the key to save under
			 * @param {(boolean|number|string)} value - the object to save
			 */
			/**
			 * Save/update a key/value pair to the user config and broadcast to the other clients
			 * @event InterfaceClient~set_userconfig_key
			 * @param {string} key - the key to save under
			 * @param {(boolean|number|string)} value - the object to save
			 * @emits InterfaceClient~set_userconfig_key:result
			 */
			client.on('set_userconfig_key', (key, value) => {
				this.setKey(key, value);
				client.broadcast.emit('set_userconfig_key:result', key, value);
			});
			/**
			 * Result call for `get_userconfig_all` that contains the requested data
			 * @event InterfaceClient~get_userconfig_all:result
			 * @param {Object.<string,(boolean|number|string)>} userconfig - the key/value pairs
			 */
			/**
			 * Retrieve the user config properties
			 * @event InterfaceClient~get_userconfig_all
			 * @param {string} key - the key to save under
			 * @param {(boolean|number|string)} value - the object to save
			 * @emits InterfaceClient~get_userconfig_all:result
			 */
			client.on('get_userconfig_all', (answer) => {
				SendResult(client, answer, 'get_userconfig_all:result', this.userconfig);
			});
		});
	}

	/**
	 * The default user config values that the core controls
	 * @type {Object.<string,(boolean|number|string)>}
	 */
	static Defaults = {
		emulator_control_enable: false,
		link_lockouts:           false,
		page_direction_flipped:  false,
		page_plusminus:          false,
		pin:                     '',
		pin_enable:              false,
		pin_timeout:             0,
		remove_toolbar:          false,
	};

	/**
	 * Get all of the user configurable settings
	 * @param {boolean} [clone = false] - `true` if a clone is needed instead of a link
	 * @returns {Object.<string,(boolean|number|string)>} the key/value pairs
	 * @access public
	 */
	get(clone = false) {
		return this.userconfig;
	}

	/**
	 * Get a specific use config setting
	 * @param {boolean} [clone = false] - `true` if a clone is needed instead of a link
	 * @returns {(boolean|number|string)} the config value
	 * @access public
	 */
	getKey(key, clone = false) {
		return this.userconfig[key];
	}

	/**
	 * Save/update a key/value pair to the user config
	 * @param {string} key - the key to save under
	 * @param {(boolean|number|string)} value - the object to save
	 * @access public
	 * @emits System~set_userconfig_key
	 */
	setKey(key, value) {
		this.userconfig[key] = value;
		debug('set_userconfig_key', key, value);
		this.log('info', 'set ' + key + ' = ' + value);
		this.system.emit('set_userconfig_key', key, value);
		this.db().setDirty();
	}
}

exports = module.exports = UserConfig;