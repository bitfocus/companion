const CoreBase = require('../Core/Base')
const { cloneDeep } = require('lodash')

/**
 * The class that manages the applications's user configurable settings
 *
 * @extends CoreBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @since 1.1.0
 * @copyright 2021 Bitfocus AS
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
class UserConfig extends CoreBase {
	/**
	 * The debugger for this class
	 * @type {debug.Debugger}
	 * @access protected
	 */
	debug = require('debug')('Data/UserConfig')

	/**
	 * The user configuration settings
	 * @type {Object.<string,(boolean|number|string)>}
	 * @protected
	 */
	userconfig

	/**
	 * @param {Registry} registry - the core registry
	 */
	constructor(registry) {
		super(registry, 'userconfig')

		this.userconfig = this.db.getKey('userconfig', UserConfig.Defaults)

		this.system.on('io_connect', (client) => {
			/**
			 * Result broadcast for `set_userconfig_key` that pushes an updated user config key/value pair
			 * @event InterfaceClient~set_userconfig_key:result
			 * @param {string} key - the saved key
			 * @param {(boolean|number|string)} value - the saved value
			 */
			/**
			 * Save/update a key/value pair to the user config and broadcast to the other clients
			 * @event InterfaceClient~set_userconfig_key
			 * @param {string} key - the key to save under
			 * @param {(boolean|number|string)} value - the object to save
			 * @emits InterfaceClient~set_userconfig_key:result
			 */
			client.on('set_userconfig_key', (key, value) => {
				this.setKey(key, value)
				client.broadcast.emit('set_userconfig_key:result', key, value)
			})
			/**
			 * Retrieve the user config properties
			 * @event InterfaceClient~get_userconfig_all
			 * @param {function} answer - UI callback
			 */
			client.on('get_userconfig_all', (answer) => {
				answer(this.userconfig)
			})
		})
	}

	/**
	 * The default user config values that the core controls
	 * @type {Object.<string,(boolean|number|string)>}
	 * @static
	 */
	static Defaults = {
		emulator_control_enable: false,
		link_lockouts: false,
		page_direction_flipped: false,
		page_plusminus: false,
		pin: '',
		pin_enable: false,
		pin_timeout: 0,
		remove_toolbar: false,
	}

	/**
	 * Get all of the user configurable settings
	 * @param {boolean} [clone = false] - <code>true</code> if a clone is needed instead of a link
	 * @returns {Object.<string,(boolean|number|string)>} the key/value pairs
	 * @access public
	 */
	get(clone = false) {
		let out = this.userconfig

		if (clone === true) {
			out = cloneDeep(out)
		}

		return this.out
	}

	/**
	 * Get a specific use config setting
	 * @param {boolean} [clone = false] - <code>true</code> if a clone is needed instead of a link
	 * @returns {(boolean|number|string)} the config value
	 * @access public
	 */
	getKey(key, clone = false) {
		let out = this.userconfig[key]

		if (clone === true) {
			out = cloneDeep(out)
		}

		return out
	}

	/**
	 * Save/update a key/value pair to the user config
	 * @param {string} key - the key to save under
	 * @param {(boolean|number|string)} value - the object to save
	 * @access public
	 */
	setKey(key, value) {
		this.userconfig[key] = value
		debug('set_userconfig_key', key, value)
		this.log('info', 'set ' + key + ' = ' + value)
		this.services.updateUserconfig(key, value)
		this.graphics.updateUserconfig(key, value)
		this.db.setDirty()
	}
}

exports = module.exports = UserConfig
