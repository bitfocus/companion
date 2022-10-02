import selfsigned from 'selfsigned'
import { cloneDeep } from 'lodash-es'
import { sendResult } from '../Resources/Util.js'
import CoreBase from '../Core/Base.js'
import Registry from '../Registry.js'

/**
 * The class that manages the applications's user configurable settings
 *
 * @extends CoreBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 1.1.0
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
class DataUserConfig extends CoreBase {
	/**
	 * The defaults for the bank fields
	 * @type {Object}
	 * @access public
	 * @static
	 */
	static Defaults = {
		setup_wizard: 0,

		page_direction_flipped: false,
		page_plusminus: false,
		remove_topbar: false,

		xkeys_enable: true,
		elgato_plugin_enable: false, // Also disables local streamdeck
		usb_hotplug: true,

		pin_enable: false,
		link_lockouts: false,
		pin: '',
		pin_timeout: 0,

		tcp_enabled: false,
		tcp_listen_port: 16759,

		udp_enabled: false,
		udp_listen_port: 16759,

		osc_enabled: false,
		osc_listen_port: 12321,

		rosstalk_enabled: false,

		emberplus_enabled: false,

		artnet_enabled: false,
		artnet_universe: 1,
		artnet_channel: 1,

		https_enabled: false,
		https_port: 8443,
		https_cert_type: 'self',
		https_self_cn: '',
		https_self_expiry: 365,
		https_self_cert: '',
		https_self_cert_created: '',
		https_self_cert_cn: '',
		https_self_cert_expiry: '',
		https_self_cert_private: '',
		https_self_cert_public: '',
		https_ext_private_key: '',
		https_ext_certificate: '',
		https_ext_chain: '',

		admin_lockout: false,
		admin_timeout: 5,
		admin_password: '',
	}
	/**
	 * The user configuration settings
	 * @type {Object.<string,(boolean|number|string)>}
	 * @access protected
	 */
	data

	/**
	 * @param {Registry} registry - the application core
	 */
	constructor(registry) {
		super(registry, 'userconfig', 'Data/UserConfig')

		this.registry.on('http_rebind', (bind_ip) => {
			if (this.data !== undefined && DataUserConfig.Defaults.https_self_cn == this.data.https_self_cn) {
				this.setKey('https_self_cn', bind_ip)
			}
			DataUserConfig.Defaults.https_self_cn = bind_ip
		})

		this.data = this.db.getKey('userconfig', cloneDeep(DataUserConfig.Defaults))

		this.checkV2InPlaceUpgrade()

		let save = false
		// copy default values. this will set newly added defaults too
		for (let k in DataUserConfig.Defaults) {
			if (this.data[k] === undefined) {
				this.data[k] = DataUserConfig.Defaults[k]
				save = true
			}
		}

		// make sure the db has an updated copy
		if (save) {
			this.db.setKey('userconfig', this.data)
		}
	}

	/**
	 * Setup a new socket client's events
	 * @param {SocketIO} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		client.on('set_userconfig_key', this.setKey.bind(this))
		client.on('set_userconfig_keys', this.setKeys.bind(this))
		client.on('reset_userconfig_key', this.resetKey.bind(this))
		client.onPromise('userconfig:get-all', () => {
			return this.data
		})

		client.on('ssl_certificate_create', this.createSslCertificate.bind(this))
		client.on('ssl_certificate_delete', this.deleteSslCertificate.bind(this))
		client.on('ssl_certificate_renew', this.renewSslSertificate.bind(this))
	}

	/**
	 * For an existing DB we need to check if some new settings are present
	 * @access protected
	 */
	checkV2InPlaceUpgrade() {
		if (!this.db.getIsFirstRun()) {
			// This is an existing db, so setup the ports to match how it used to be
			const legacy_config = {
				tcp_enabled: true,
				tcp_listen_port: 51234,

				udp_enabled: true,
				udp_listen_port: 51235,

				osc_enabled: true,
				osc_listen_port: 12321,

				emberplus_enabled: true,

				xkeys_enable: false,
			}

			// check if these fields have already been defined
			let has_been_defined = false
			for (const k in legacy_config) {
				if (this.data[k] !== undefined) {
					has_been_defined = true
					break
				}
			}

			// copy across the legacy values
			if (!has_been_defined) {
				this.logger.info('Running one-time userconfig v2 upgrade')
				for (let k in legacy_config) {
					if (this.data[k] === undefined) {
						this.data[k] = legacy_config[k]
					}
				}
			}

			// Preserve old behaviour
			if (this.data['usb_hotplug'] === undefined) {
				this.data['usb_hotplug'] = false
			}
		}
	}

	/**
	 * Generate a self-signed SSL certificate
	 * @access protected
	 */
	createSslCertificate() {
		try {
			const attrs = [{ name: 'commonName', value: this.data.https_self_cn }]
			const pems = selfsigned.generate(attrs, {
				days: this.data.https_self_expiry,
				algorithm: 'sha256',
				keySize: 2048,
			})
			if (pems.private && pems.public && pems.cert) {
				const cert = {
					https_self_cert_public: pems.public,
					https_self_cert_private: pems.private,
					https_self_cert: pems.cert,
					https_self_cert_cn: this.data.https_self_cn,
					https_self_cert_created: new Date().toLocaleString(),
					https_self_cert_expiry: `${this.data.https_self_expiry} days`,
				}

				this.setKeys(cert)
			} else {
				this.logger.error(`Couldn't generate certificate: not all pems returned`)
			}
		} catch (e) {
			this.logger.error(`Couldn't generate certificate`, e)
		}
	}

	/**
	 * Delete a stored self-signed SSL certificate
	 * @access protected
	 */
	deleteSslCertificate() {
		this.setKeys({
			https_self_cert: '',
			https_self_cert_created: '',
			https_self_cert_cn: '',
			https_self_cert_expiry: '',
			https_self_cert_private: '',
			https_self_cert_public: '',
		})
	}

	/**
	 * Get all of the user configurable settings
	 * @param {boolean} [clone = false] - <code>true</code> if a clone is needed instead of a link
	 * @returns {Object.<string,(boolean|number|string)>} the key/value pairs
	 * @access public
	 */
	get(clone = false) {
		let out = this.data

		if (clone === true) {
			out = cloneDeep(out)
		}

		return out
	}

	/**
	 * Get a specific use config setting
	 * @param {boolean} [clone = false] - <code>true</code> if a clone is needed instead of a link
	 * @returns {(boolean|number|string)} the config value
	 * @access public
	 */
	getKey(key, clone = false) {
		let out = this.data[key]

		if (clone === true) {
			out = cloneDeep(out)
		}

		return out
	}

	/**
	 * Try to renew a stored self-signed SSL certificate
	 * @access protected
	 */
	renewSslSertificate() {
		try {
			const attrs = [{ name: 'commonName', value: this.data.https_self_cert_cn }]
			const pems = selfsigned.generate(attrs, {
				days: this.data.https_self_expiry,
				algorithm: 'sha256',
				keySize: 2048,
				keyPair: {
					publicKey: this.data.https_self_cert_public,
					privateKey: this.data.https_self_cert_private,
				},
			})
			if (pems.private && pems.public && pems.cert) {
				const cert = {
					https_self_cert: pems.cert,
					https_self_cert_created: new Date().toLocaleString(),
					https_self_cert_expiry: `${this.data.https_self_expiry} days`,
				}

				this.setKeys(cert)
			} else {
				this.logger.error(`Couldn't renew certificate: not all pems returned`)
			}
		} catch (e) {
			this.logger.error(`Couldn't renew certificate`, e)
		}
	}

	/**
	 * Reset a user config to its default
	 * @param {string} key - the key to reset
	 * @access public
	 */
	resetKey(key) {
		this.setKey(key, DataUserConfig.Defaults[key])
	}

	/**
	 * Save/update a key/value pair to the user config
	 * @param {string} key - the key to save under
	 * @param {(boolean|number|string)} value - the object to save
	 * @param {boolean} [save = true] - <code>false</code> if a DB save is not necessary
	 * @access public
	 */
	setKey(key, value, save = true) {
		this.data[key] = value
		this.logger.info(`set '${key}' to: ${value}`)
		this.io.emit('set_userconfig_key', key, value)
		setImmediate(() => {
			// give the change a chance to be pushed to the ui first
			this.graphics.updateUserConfig(key, value)
			this.services.updateUserConfig(key, value)
			this.surfaces.updateUserConfig(key, value)
		})

		if (save) {
			this.db.setKey('userconfig', this.data)
		}
	}

	/**
	 * Save/update multiple key/value pairs to the user config
	 * @param {Object.<string,(boolean|number|string)>} objects - the key/value pairs
	 * @access public
	 */
	setKeys(objects) {
		if (objects !== undefined) {
			for (let key in objects) {
				this.setKey(key, objects[key], false)
			}

			this.db.setKey('userconfig', this.data)
		}
	}
}

export default DataUserConfig
