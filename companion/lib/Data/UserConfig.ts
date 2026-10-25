import { EventEmitter } from 'node:events'
import { nanoid } from 'nanoid'
import selfsigned from 'selfsigned'
import z from 'zod'
import { BANNED_PROPS } from '@companion-app/shared/Expressions.js'
import {
	UserConfigModelSchema,
	type UserConfigModel,
	type UserConfigUpdate,
} from '@companion-app/shared/Model/UserConfigModel.js'
import LogController from '../Log/Controller.js'
import type { AppInfo } from '../Registry.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import type { DataDatabase } from './Database.js'
import type { DataStoreKeyedSchemaTableView } from './Tables/KeyedSchemaTableView.js'

const UserConfigTableSchemas = {
	userconfig: UserConfigModelSchema.default(() => UserConfigModelSchema.parse({})),
}

/**
 * Reset each setting that fails to parse to its default, rather than every setting. A backup rule that fails is
 * removed, rather than all of them
 */
function repairUserConfig(
	row: unknown,
	issues: readonly z.core.$ZodIssue[]
): { row: unknown; repairs: string[] } | null {
	if (!row || typeof row !== 'object' || Array.isArray(row)) return null

	const repaired: Record<string, unknown> = { ...row }
	const resetKeys = new Set<string>()
	const removedBackups = new Set<number>()
	for (const issue of issues) {
		const [key, index] = issue.path
		if (typeof key !== 'string') return null

		if (key === 'backups' && typeof index === 'number' && Array.isArray(repaired.backups)) {
			removedBackups.add(index)
		} else {
			resetKeys.add(key)
		}
	}

	const repairs: string[] = []
	for (const key of resetKeys) {
		delete repaired[key]
		repairs.push(`Reset the setting "${key}" to its default`)
	}
	if (removedBackups.size > 0 && Array.isArray(repaired.backups)) {
		repaired.backups = repaired.backups.filter((_rule, index) => !removedBackups.has(index))
		repairs.push(`Removed ${removedBackups.size} invalid backup rule(s)`)
	}

	return { row: repaired, repairs }
}

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

	readonly #dbTable: DataStoreKeyedSchemaTableView<typeof UserConfigTableSchemas>

	/**
	 * Launch-time overrides (e.g. from an environment variable). Keys present here are locked: their
	 * value is layered over the persisted config at read time and cannot be edited in the UI. The
	 * override is never written to the db, so removing it restores the stored value.
	 */
	readonly #lockedOverrides = new Map<keyof UserConfigModel, any>()

	/**
	 * The defaults for the user config fields
	 */
	static Defaults: UserConfigModel = UserConfigModelSchema.parse({})

	/**
	 * The user configuration settings
	 */
	#data: UserConfigModel

	constructor(appInfo: AppInfo, db: DataDatabase) {
		super()
		this.setMaxListeners(0)

		this.#dbTable = db.getKeyedSchemaTableView('main', UserConfigTableSchemas, {
			repair: { userconfig: repairUserConfig },
		})

		if (appInfo.options.installNameOverride !== undefined) {
			this.#lockedOverrides.set('installName', appInfo.options.installNameOverride)
		}

		this.#data = this.#dbTable.get('userconfig')
	}

	/**
	 * Layer any launch-time overrides over a snapshot of the persisted config. Returns the input
	 * unchanged (by reference) when there are no overrides.
	 */
	#applyOverrides(data: UserConfigModel): UserConfigModel {
		if (this.#lockedOverrides.size === 0) return data

		const out = { ...data }
		for (const [key, value] of this.#lockedOverrides) {
			// @ts-expect-error mismatch in key type
			out[key] = value
		}
		return out
	}

	createTrpcRouter() {
		const self = this
		const selfEvents: EventEmitter<DataUserConfigEvents> = self
		const zodUserConfigKey = UserConfigModelSchema.keyof()
		return router({
			sslCertificateCreate: publicProcedure.mutation(async () => {
				return this.createSslCertificate()
			}),
			sslCertificateDelete: publicProcedure.mutation(async () => {
				return this.deleteSslCertificate()
			}),
			sslCertificateRenew: publicProcedure.mutation(async () => {
				return this.renewSslCertificate()
			}),

			prometheusTokenRegenerate: publicProcedure.mutation(() => {
				return this.regeneratePrometheusToken()
			}),

			getConfig: publicProcedure.query(() => {
				return this.#applyOverrides(this.#data)
			}),

			getLockedKeys: publicProcedure.query(() => {
				return [...this.#lockedOverrides.keys()]
			}),

			watchConfig: publicProcedure.subscription(async function* ({ signal }) {
				const changes = toIterable(selfEvents, 'keyChanged', signal)

				yield { type: 'init', config: self.#applyOverrides(self.#data) } satisfies UserConfigUpdate

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
	 * Generate a self-signed SSL certificate
	 */
	private async createSslCertificate(): Promise<void> {
		try {
			const attrs: selfsigned.CertificateField[] = [{ name: 'commonName', value: String(this.#data.https_self_cn) }]

			const days = Number(this.#data.https_self_expiry) || undefined
			const pems = await selfsigned.generate(attrs, {
				notAfterDate: days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : undefined,
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
	 * Get a copy of the entire user config object
	 */
	getAll(): UserConfigModel {
		return this.#applyOverrides(structuredClone(this.#data))
	}

	/**
	 * Get a specific use config setting
	 * @param key
	 * @param [clone = false] - <code>true</code> if a clone is needed instead of a link
	 * @returns the config value
	 */
	getKey(key: keyof UserConfigModel, clone = false): any {
		let out = this.#lockedOverrides.has(key) ? this.#lockedOverrides.get(key) : this.#data[key]

		if (clone === true) {
			out = structuredClone(out)
		}

		return out
	}

	/**
	 * Try to renew a stored self-signed SSL certificate
	 * @access protected
	 */
	private async renewSslCertificate(): Promise<void> {
		try {
			const attrs: selfsigned.CertificateField[] = [
				{ name: 'commonName', value: String(this.#data.https_self_cert_cn) },
			]
			const days = Number(this.#data.https_self_expiry) || undefined
			const pems = await selfsigned.generate(attrs, {
				notAfterDate: days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : undefined,
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

		// Block updates to any key that is locked by a launch-time override (e.g. an environment variable)
		if (this.#lockedOverrides.has(key)) {
			this.#logger.warn(`Ignoring update to '${String(key)}': it is locked by a launch-time override`)
			return
		}

		if (BANNED_PROPS.has(String(key))) throw new Error(`Setting config key "${String(key)}" is not allowed`)

		// Ensure a token exists whenever the metrics endpoint is enabled, so it can never be exposed without auth
		if (key === 'prometheus_enabled' && value && !this.#data.prometheus_token) {
			this.setKeyUnchecked('prometheus_token', nanoid(32), false)
		}

		this.setKeyUnchecked(key, value, save)
	}

	/**
	 * Generate a fresh prometheus bearer token, invalidating the previous one
	 */
	regeneratePrometheusToken(): string {
		const token = nanoid(32)
		this.setKey('prometheus_token', token)
		return token
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

		const keySchema = (UserConfigModelSchema.shape as Record<string, z.ZodType | undefined>)[key]
		if (!keySchema) throw new Error(`Unknown config key "${String(key)}"`)
		const parsed = keySchema.safeParse(value)
		if (!parsed.success) {
			throw new Error(`Invalid value for config key "${String(key)}": ${z.prettifyError(parsed.error)}`)
		}
		value = parsed.data

		const checkControlsInBounds = key === 'gridSize'

		// @ts-expect-error mismatch in key type
		this.#data[key] = value
		if (save) {
			this.#dbTable.set('userconfig', this.#data)
		}

		// Never log the value of secret keys - the prometheus token is a live scrape credential
		if (key === 'prometheus_token') {
			this.#logger.info(`set '${key}' to: <redacted>`)
		} else {
			this.#logger.info(`set '${key}' to: ${JSON.stringify(value)}`)
		}

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
