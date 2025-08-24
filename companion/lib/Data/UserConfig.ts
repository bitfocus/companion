import selfsigned from 'selfsigned'
import { cloneDeep } from 'lodash-es'
import type { UserConfigModel, UserConfigUpdate } from '@companion-app/shared/Model/UserConfigModel.js'
import { EventEmitter } from 'events'
import type { DataDatabase, DataDatabaseDefaultTable } from './Database.js'
import LogController from '../Log/Controller.js'
import { DataStoreTableView } from './StoreBase.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import z from 'zod'

export interface DataUserConfigEvents {
	keyChanged: [key: keyof UserConfigModel, value: any, checkControlsInBounds: boolean]
}

/**
 * The class that manages the applications's user configurable settings
 *
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
 */
export class DataUserConfig extends EventEmitter<DataUserConfigEvents> {
	readonly #logger = LogController.createLogger('Data/UserConfig')

	readonly #db: DataDatabase
	readonly #dbTable: DataStoreTableView<DataDatabaseDefaultTable>

	/**
	 * The defaults for the user config fields
	 */
	static Defaults: UserConfigModel = {
		setup_wizard: 0,

		page_direction_flipped: false,
		page_plusminus: false,
		remove_topbar: false,

		xkeys_enable: true,
		elgato_plugin_enable: false, // Also disables local streamdeck
		usb_hotplug: true,
		loupedeck_enable: false,
		mirabox_streamdock_enable: true,
		contour_shuttle_enable: false,
		vec_footpedal_enable: false,
		blackmagic_controller_enable: false,
		mystrix_enable: false,
		logitech_mx_console_enable: false,

		pin_enable: false,
		link_lockouts: false,
		pin: '',
		pin_timeout: 0,

		http_api_enabled: true,
		http_legacy_api_enabled: false,

		tcp_enabled: false,
		tcp_listen_port: 16759,
		tcp_legacy_api_enabled: false,

		udp_enabled: false,
		udp_listen_port: 16759,
		udp_legacy_api_enabled: false,

		osc_enabled: false,
		osc_listen_port: 12321,
		osc_legacy_api_enabled: false,

		rosstalk_enabled: false,

		emberplus_enabled: false,

		videohub_panel_enabled: false,

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

		gridSize: {
			minColumn: 0,
			maxColumn: 7,
			minRow: 0,
			maxRow: 3,
		},
		gridSizeInlineGrow: false, // TODO: temporary until the styling of growing is better
		gridSizePromptGrow: true,

		installName: '',
		default_export_filename: '$(internal:hostname)_$(internal:date_iso)-$(internal:time_h)$(internal:time_m)',

		backups: [
			// Create a disabled backup rule by default
			{
				id: 'default',
				enabled: false,
				name: 'Daily Backup',
				backupType: 'db',
				backupPath: '', // Default
				cron: '0 0 * * *', // Daily at midnight
				backupNamePattern: 'backup-$(internal:date_iso)-$(internal:time_h)$(internal:time_m)',
				keep: 5,
				previousBackups: [],
				lastRan: 0,
			},
		],

		discoveryEnabled: true,
	}
	/**
	 * The user configuration settings
	 */
	#data: UserConfigModel

	constructor(db: DataDatabase) {
		super()
		this.setMaxListeners(0)

		this.#db = db
		this.#dbTable = db.defaultTableView

		this.#data = this.#dbTable.getOrDefault('userconfig', cloneDeep(DataUserConfig.Defaults))

		this.#populateMissingForExistingDb()

		let save = false
		// copy default values. this will set newly added defaults too
		for (const k0 in DataUserConfig.Defaults) {
			const k = k0 as keyof UserConfigModel
			if (this.#data[k] === undefined) {
				// @ts-expect-error mismatch in key type
				this.#data[k] = DataUserConfig.Defaults[k]
				save = true
			}
		}

		// make sure the db has an updated copy
		if (save) {
			this.#dbTable.set('userconfig', this.#data)
		}
	}

	createTrpcRouter() {
		const self = this
		const selfEvents: EventEmitter<DataUserConfigEvents> = self
		const zodUserConfigKey = z.enum(Object.keys(DataUserConfig.Defaults) as [keyof UserConfigModel])
		return router({
			sslCertificateCreate: publicProcedure.mutation(() => {
				return this.createSslCertificate()
			}),
			sslCertificateDelete: publicProcedure.mutation(() => {
				return this.deleteSslCertificate()
			}),
			sslCertificateRenew: publicProcedure.mutation(() => {
				return this.renewSslCertificate()
			}),

			getConfig: publicProcedure.query(() => {
				return this.#data
			}),

			watchConfig: publicProcedure.subscription(async function* ({ signal }) {
				const changes = toIterable(selfEvents, 'keyChanged', signal)

				yield { type: 'init', config: self.#data } satisfies UserConfigUpdate

				for await (const [key, value] of changes) {
					yield { type: 'key', key, value } satisfies UserConfigUpdate
				}
			}),

			setConfigKey: publicProcedure
				.input(
					z.object({
						key: zodUserConfigKey,
						value: z.any(),
					})
				)
				.mutation(({ input }) => {
					return this.setKey(input.key, input.value)
				}),

			setConfigKeys: publicProcedure
				.input(
					z.object({
						values: z.record(z.string(), z.any()),
					})
				)
				.mutation(({ input }) => {
					return this.setKeys(input.values)
				}),

			resetConfigKey: publicProcedure
				.input(
					z.object({
						key: zodUserConfigKey,
					})
				)
				.mutation(({ input }) => {
					return this.resetKey(input.key)
				}),
		})
	}

	/**
	 * For an existing DB we need to check if some new settings are present
	 */
	#populateMissingForExistingDb(): void {
		if (!this.#db.getIsFirstRun()) {
			// This is an existing db, so setup the ports to match how it used to be
			const legacy_config: Partial<UserConfigModel> = {
				tcp_enabled: true,
				tcp_listen_port: 51234,

				udp_enabled: true,
				udp_listen_port: 51235,

				osc_enabled: true,
				osc_listen_port: 12321,

				emberplus_enabled: true,

				xkeys_enable: false,

				discoveryEnabled: true,
			}

			// check if these fields have already been defined
			let has_been_defined = false
			for (const k in legacy_config) {
				// @ts-expect-error mismatch in key type
				if (this.#data[k] !== undefined) {
					has_been_defined = true
					break
				}
			}

			// copy across the legacy values
			if (!has_been_defined) {
				this.#logger.info('Running one-time userconfig v2 upgrade')
				for (const k in legacy_config) {
					// @ts-expect-error mismatch in key type
					if (this.#data[k] === undefined) {
						// @ts-expect-error mismatch in key type
						this.#data[k] = legacy_config[k]
					}
				}
			}

			// Preserve old behaviour
			if (this.#data['usb_hotplug'] === undefined) {
				this.#data['usb_hotplug'] = false
			}

			// Enable the legacy OSC api if OSC is enabled
			if (this.#data.osc_enabled && this.#data.osc_legacy_api_enabled === undefined) {
				this.#data.osc_legacy_api_enabled = true
			}

			// Enable the legacy TCP api if TCP is enabled
			if (this.#data.tcp_enabled && this.#data.tcp_legacy_api_enabled === undefined) {
				this.#data.tcp_legacy_api_enabled = true
			}

			// Enable the legacy UDP api if UDP is enabled
			if (this.#data.udp_enabled && this.#data.udp_legacy_api_enabled === undefined) {
				this.#data.udp_legacy_api_enabled = true
			}

			// Enable the http api (both modern and legacy)
			if (this.#data.http_api_enabled === undefined) {
				this.#data.http_api_enabled = true
				this.#data.http_legacy_api_enabled = true
			}
		}
	}

	/**
	 * Generate a self-signed SSL certificate
	 */
	private createSslCertificate(): void {
		try {
			const attrs: selfsigned.CertificateField[] = [{ name: 'commonName', value: String(this.#data.https_self_cn) }]
			const pems = selfsigned.generate(attrs, {
				days: Number(this.#data.https_self_expiry) || undefined,
				algorithm: 'sha256',
				keySize: 2048,
			})
			if (pems.private && pems.public && pems.cert) {
				const cert = {
					https_self_cert_public: pems.public,
					https_self_cert_private: pems.private,
					https_self_cert: pems.cert,
					https_self_cert_cn: this.#data.https_self_cn,
					https_self_cert_created: new Date().toLocaleString(),
					https_self_cert_expiry: `${Number(this.#data.https_self_expiry)} days`,
				}

				this.setKeys(cert)
			} else {
				this.#logger.error(`Couldn't generate certificate: not all pems returned`)
			}
		} catch (e) {
			this.#logger.error(`Couldn't generate certificate`, e)
		}
	}

	/**
	 * Delete a stored self-signed SSL certificate
	 */
	private deleteSslCertificate(): void {
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
	 * Get a specific use config setting
	 * @param key
	 * @param [clone = false] - <code>true</code> if a clone is needed instead of a link
	 * @returns the config value
	 */
	getKey(key: keyof UserConfigModel, clone = false): any {
		let out = this.#data[key]

		if (clone === true) {
			out = cloneDeep(out)
		}

		return out
	}

	/**
	 * Try to renew a stored self-signed SSL certificate
	 * @access protected
	 */
	private renewSslCertificate(): void {
		try {
			const attrs: selfsigned.CertificateField[] = [
				{ name: 'commonName', value: String(this.#data.https_self_cert_cn) },
			]
			const pems = selfsigned.generate(attrs, {
				days: Number(this.#data.https_self_expiry) || undefined,
				algorithm: 'sha256',
				keySize: 2048,
				// keyPair: {
				// 	publicKey: String(this.data.https_self_cert_public),
				// 	privateKey: String(this.data.https_self_cert_private),
				// },
			})
			if (pems.private && pems.public && pems.cert) {
				const cert = {
					https_self_cert: pems.cert,
					https_self_cert_created: new Date().toLocaleString(),
					https_self_cert_expiry: `${Number(this.#data.https_self_expiry)} days`,
				}

				this.setKeys(cert)
			} else {
				this.#logger.error(`Couldn't renew certificate: not all pems returned`)
			}
		} catch (e) {
			this.#logger.error(`Couldn't renew certificate`, e)
		}
	}

	/**
	 * Reset the user config to the default
	 */
	reset(): void {
		this.setKeys(DataUserConfig.Defaults)
	}

	/**
	 * Reset a user config to its default
	 * @param key - the key to reset
	 */
	resetKey(key: keyof UserConfigModel): void {
		this.setKey(key, DataUserConfig.Defaults[key])
	}

	/**
	 * Save/update a key/value pair to the user config
	 * @param key - the key to save under
	 * @param value - the object to save
	 * @param save - <code>false</code> if a DB save is not necessary
	 */
	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	setKey(key: keyof UserConfigModel, value: any, save = true): void {
		if (!key) throw new Error('Missing key')

		// Block direct updates to backup configuration
		if (key === 'backups') {
			this.#logger.warn(
				`Direct updates to 'backups' configuration are not allowed. Use backup-rules endpoints instead.`
			)
			return
		}

		this.setKeyUnchecked(key, value, save)
	}

	/**
	 * Save/update a key/value pair to the user config, without checking for blocked keys
	 * @param key - the key to save under
	 * @param value - the object to save
	 * @param save - <code>false</code> if a DB save is not necessary
	 */
	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	setKeyUnchecked(key: keyof UserConfigModel, value: any, save = true): void {
		if (!key) throw new Error('Missing key')

		let checkControlsInBounds = false
		if (key === 'gridSize') {
			// value = { ...value }

			// value = Math.min(0, Number(value))
			// if (isNaN(value)) return
			checkControlsInBounds = true
		}

		// @ts-expect-error mismatch in key type
		this.#data[key] = value
		if (save) {
			this.#dbTable.set('userconfig', this.#data)
		}

		this.#logger.info(`set '${key}' to: ${JSON.stringify(value)}`)

		this.emit('keyChanged', key, value, checkControlsInBounds)
	}

	/**
	 * Save/update multiple key/value pairs to the user config
	 * @param objects - the key/value pairs
	 */
	setKeys(objects: Record<string, any>): void {
		if (objects !== undefined) {
			for (const key in objects) {
				// @ts-expect-error mismatch in key type
				this.setKey(key, objects[key], false)
			}

			this.#dbTable.set('userconfig', this.#data)
		}
	}

	updateBindIp(bindIp: string): void {
		if (this.#data !== undefined && DataUserConfig.Defaults.https_self_cn == this.#data.https_self_cn) {
			this.setKey('https_self_cn', bindIp)
		}
		DataUserConfig.Defaults.https_self_cn = bindIp
	}
}
