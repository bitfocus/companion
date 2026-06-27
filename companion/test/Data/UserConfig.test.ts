import { initTRPC } from '@trpc/server'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { DataUserConfig } from '../../lib/Data/UserConfig.js'
import type { TrpcContext } from '../../lib/UI/TRPC.js'
import { createMockTrpcContext } from '../Util.js'
import { FakeDataDatabase } from '../utils/FakeTableView.js'
import { SubscriptionTester } from '../utils/SubscriptionTester.js'

const t = initTRPC.context<TrpcContext>().create()
const testCtx: TrpcContext = createMockTrpcContext()

function createUserConfig(opts: { firstRun?: boolean; existing?: Partial<UserConfigModel> } = {}) {
	const db = new FakeDataDatabase()
	db.isFirstRun = opts.firstRun ?? true
	const table = db.defaultTableView
	if (opts.existing) table.data['userconfig'] = structuredClone(opts.existing)

	const userconfig = new DataUserConfig(db.asDataDatabase())
	const caller = t.createCallerFactory(userconfig.createTrpcRouter())(testCtx)

	return { db, table, userconfig, caller }
}

describe('DataUserConfig', () => {
	describe('setup', () => {
		test('a first run uses and persists the defaults', () => {
			const { userconfig, table } = createUserConfig({ firstRun: true })

			expect(userconfig.getAll()).toEqual(DataUserConfig.Defaults)
			expect(table.data['userconfig']).toEqual(DataUserConfig.Defaults)
		})

		test('an existing db without service fields gets the one-time v2 upgrade', () => {
			const { userconfig } = createUserConfig({
				firstRun: false,
				existing: { setup_wizard: 22 },
			})

			// The legacy services are kept enabled with their old ports
			expect(userconfig.getKey('tcp_enabled')).toBe(true)
			expect(userconfig.getKey('tcp_listen_port')).toBe(51234)
			expect(userconfig.getKey('udp_enabled')).toBe(true)
			expect(userconfig.getKey('udp_listen_port')).toBe(51235)
			expect(userconfig.getKey('osc_enabled')).toBe(true)
			expect(userconfig.getKey('osc_listen_port')).toBe(12321)
			expect(userconfig.getKey('emberplus_enabled')).toBe(true)

			// Old behaviour is preserved
			expect(userconfig.getKey('usb_hotplug')).toBe(false)
			expect(userconfig.getKey('osc_legacy_api_enabled')).toBe(true)
			expect(userconfig.getKey('tcp_legacy_api_enabled')).toBe(true)
			expect(userconfig.getKey('udp_legacy_api_enabled')).toBe(true)
			expect(userconfig.getKey('http_api_enabled')).toBe(true)
			expect(userconfig.getKey('http_legacy_api_enabled')).toBe(true)

			// And the original data is intact
			expect(userconfig.getKey('setup_wizard')).toBe(22)
		})

		test('an existing db with any service field defined skips the v2 upgrade', () => {
			const { userconfig } = createUserConfig({
				firstRun: false,
				existing: { setup_wizard: 22, osc_enabled: false, usb_hotplug: true },
			})

			// The other services get the modern defaults instead
			expect(userconfig.getKey('tcp_enabled')).toBe(DataUserConfig.Defaults.tcp_enabled)
			expect(userconfig.getKey('tcp_listen_port')).toBe(DataUserConfig.Defaults.tcp_listen_port)
			expect(userconfig.getKey('usb_hotplug')).toBe(true)
		})

		test('newly added defaults are backfilled and saved', () => {
			const { userconfig, table } = createUserConfig({
				firstRun: false,
				existing: { setup_wizard: 22, osc_enabled: false },
			})

			// Every default key is now present
			for (const key of Object.keys(DataUserConfig.Defaults)) {
				expect(userconfig.getKey(key as keyof UserConfigModel)).not.toBe(undefined)
			}
			expect(table.data['userconfig'].gridSize).toEqual(DataUserConfig.Defaults.gridSize)
		})
	})

	describe('get', () => {
		test('getKey clone semantics', () => {
			const { userconfig } = createUserConfig()

			const live = userconfig.getKey('gridSize')
			expect(userconfig.getKey('gridSize')).toBe(live)

			const cloned = userconfig.getKey('gridSize', true)
			expect(cloned).toEqual(live)
			expect(cloned).not.toBe(live)
		})

		test('getAll returns a clone', () => {
			const { userconfig } = createUserConfig()

			const all = userconfig.getAll()
			all.pin = 'mutated'

			expect(userconfig.getKey('pin')).toBe('')
		})
	})

	describe('setKey', () => {
		test('updates the value, persists and emits', () => {
			const { userconfig, table } = createUserConfig()
			const keyChanged = vi.fn()
			userconfig.on('keyChanged', keyChanged)

			userconfig.setKey('pin', '1234')

			expect(userconfig.getKey('pin')).toBe('1234')
			expect(table.data['userconfig'].pin).toBe('1234')
			expect(keyChanged).toHaveBeenCalledWith('pin', '1234', false)
		})

		test('gridSize changes request a bounds check of controls', () => {
			const { userconfig } = createUserConfig()
			const keyChanged = vi.fn()
			userconfig.on('keyChanged', keyChanged)

			const newSize = { minColumn: 0, maxColumn: 15, minRow: 0, maxRow: 7 }
			userconfig.setKey('gridSize', newSize)

			expect(keyChanged).toHaveBeenCalledWith('gridSize', newSize, true)
		})

		test('direct updates to backups are blocked', () => {
			const { userconfig } = createUserConfig()
			const keyChanged = vi.fn()
			userconfig.on('keyChanged', keyChanged)

			userconfig.setKey('backups', [])

			expect(userconfig.getKey('backups')).toEqual(DataUserConfig.Defaults.backups)
			expect(keyChanged).not.toHaveBeenCalled()
		})

		test('setKeyUnchecked bypasses the backups guard', () => {
			const { userconfig } = createUserConfig()

			userconfig.setKeyUnchecked('backups', [])

			expect(userconfig.getKey('backups')).toEqual([])
		})

		test('reserved and missing keys are rejected', () => {
			const { userconfig } = createUserConfig()

			expect(() => userconfig.setKey('__proto__' as any, 'evil')).toThrow(/not allowed/)
			expect(() => userconfig.setKey('' as any, 'x')).toThrow(/Missing key/)
		})
	})

	describe('setKeys', () => {
		test('sets multiple values with a single save', () => {
			const { userconfig, table } = createUserConfig()
			const tableSet = vi.spyOn(table, 'set')

			userconfig.setKeys({ pin: '9999', pin_enable: true })

			expect(userconfig.getKey('pin')).toBe('9999')
			expect(userconfig.getKey('pin_enable')).toBe(true)
			expect(tableSet).toHaveBeenCalledTimes(1)
		})
	})

	describe('reset', () => {
		test('resetKey restores the default', () => {
			const { userconfig } = createUserConfig()
			userconfig.setKey('pin_timeout', 99)

			userconfig.resetKey('pin_timeout')

			expect(userconfig.getKey('pin_timeout')).toBe(DataUserConfig.Defaults.pin_timeout)
		})

		test('reset restores all defaults, except the guarded backups', () => {
			const { userconfig } = createUserConfig()
			userconfig.setKey('pin', '1234')
			userconfig.setKeyUnchecked('backups', [])

			userconfig.reset()

			expect(userconfig.getKey('pin')).toBe('')
			// The backups guard also applies during a reset
			expect(userconfig.getKey('backups')).toEqual([])
		})
	})

	describe('updateBindIp', () => {
		const originalDefaultCn = DataUserConfig.Defaults.https_self_cn
		afterEach(() => {
			DataUserConfig.Defaults.https_self_cn = originalDefaultCn
		})

		test('follows the bind ip while the cn is unchanged from the default', () => {
			const { userconfig } = createUserConfig()

			userconfig.updateBindIp('192.168.1.10')

			expect(userconfig.getKey('https_self_cn')).toBe('192.168.1.10')
			expect(DataUserConfig.Defaults.https_self_cn).toBe('192.168.1.10')
		})

		test('a customised cn is left alone', () => {
			const { userconfig } = createUserConfig()
			userconfig.setKey('https_self_cn', 'my.host.example')

			userconfig.updateBindIp('192.168.1.10')

			expect(userconfig.getKey('https_self_cn')).toBe('my.host.example')
			expect(DataUserConfig.Defaults.https_self_cn).toBe('192.168.1.10')
		})
	})

	describe('trpc', () => {
		test('getConfig and setConfigKey round-trip', async () => {
			const { userconfig, caller } = createUserConfig()

			await caller.setConfigKey({ key: 'pin', value: '4321' })
			expect(userconfig.getKey('pin')).toBe('4321')

			const config = await caller.getConfig()
			expect(config.pin).toBe('4321')

			await caller.resetConfigKey({ key: 'pin' })
			expect(userconfig.getKey('pin')).toBe('')
		})

		test('setConfigKeys sets multiple values', async () => {
			const { userconfig, caller } = createUserConfig()

			await caller.setConfigKeys({ values: { pin: '1111', pin_enable: true } })

			expect(userconfig.getKey('pin')).toBe('1111')
			expect(userconfig.getKey('pin_enable')).toBe(true)
		})

		test('watchConfig yields init then key changes', async () => {
			const { userconfig, caller } = createUserConfig()

			const subscription = new SubscriptionTester(await caller.watchConfig())
			const init = (await subscription.next()) as any
			expect(init.type).toBe('init')
			expect(init.config.pin).toBe('')

			userconfig.setKey('pin', '2222')
			await subscription.expectValue({ type: 'key', key: 'pin', value: '2222' })

			await subscription.cleanup()
		})

		test('sslCertificateDelete clears the certificate keys', async () => {
			const { userconfig, caller } = createUserConfig()
			userconfig.setKeys({
				https_self_cert: 'CERT',
				https_self_cert_private: 'KEY',
				https_self_cert_public: 'PUB',
				https_self_cert_cn: 'host',
			})

			await caller.sslCertificateDelete()

			expect(userconfig.getKey('https_self_cert')).toBe('')
			expect(userconfig.getKey('https_self_cert_private')).toBe('')
			expect(userconfig.getKey('https_self_cert_public')).toBe('')
			expect(userconfig.getKey('https_self_cert_cn')).toBe('')
		})

		test('sslCertificateCreate generates and stores a certificate', async () => {
			const { userconfig, caller } = createUserConfig()
			userconfig.setKey('https_self_cn', 'companion.test')

			await caller.sslCertificateCreate()

			expect(userconfig.getKey('https_self_cert')).toContain('BEGIN CERTIFICATE')
			expect(userconfig.getKey('https_self_cert_private')).toContain('PRIVATE KEY')
			expect(userconfig.getKey('https_self_cert_cn')).toBe('companion.test')
			expect(userconfig.getKey('https_self_cert_expiry')).toBe('365 days')
		}, 15000)
	})
})
