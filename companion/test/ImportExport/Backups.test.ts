import { EventEmitter } from 'node:events'
import path from 'node:path'
import { initTRPC } from '@trpc/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { mockDeep } from 'vitest-mock-extended'
import {
	BackupRulesConfigSchema,
	type BackupRulesConfig,
	type PreviousBackupInfo,
} from '@companion-app/shared/Model/UserConfigModel.js'
import type { DataDatabase } from '../../lib/Data/Database.js'
import type { DataUserConfig, DataUserConfigEvents } from '../../lib/Data/UserConfig.js'
import { BackupController } from '../../lib/ImportExport/Backups.js'
import type { ExportController } from '../../lib/ImportExport/Export.js'
import type { AppInfo } from '../../lib/Registry.js'
import type { TrpcContext } from '../../lib/UI/TRPC.js'
import type { VariablesValues } from '../../lib/Variables/Values.js'
import { createMockTrpcContext } from '../Util.js'

const fsMock = vi.hoisted(() => ({
	mkdir: vi.fn(),
	access: vi.fn(),
	unlink: vi.fn(),
}))
vi.mock('node:fs/promises', () => ({ default: fsMock }))

const cronMock = vi.hoisted(() => ({ schedule: vi.fn() }))
vi.mock('node-cron', async (importOriginal) => {
	const actual = await importOriginal<{ default: { validate: (cron: string) => boolean } }>()
	// Validation is real, so an invalid cron expression is still refused
	return { default: { validate: actual.default.validate, schedule: cronMock.schedule } }
})

const writeExportToFile = vi.hoisted(() => vi.fn())
vi.mock('../../lib/ImportExport/Util.js', () => ({ writeExportToFile }))

const t = initTRPC.context<TrpcContext>().create()
const testCtx: TrpcContext = createMockTrpcContext()

const DEFAULT_DIR = path.join('/config', 'backups')

/** Saves the rules, and reports the change, as the real user config does */
class FakeUserConfig extends EventEmitter<DataUserConfigEvents> {
	saved: BackupRulesConfig[] | undefined
	setKeyUnchecked(key: string, value: BackupRulesConfig[]): void {
		if (key !== 'backups') throw new Error(`Unexpected key ${key}`)
		// The real user config parses what it is given, so hands back a copy
		this.saved = structuredClone(value)
		this.emit('keyChanged', { key: 'backups', value: structuredClone(value) }, false)
	}
}

function makeRule(overrides: Partial<BackupRulesConfig> & { id: string }): BackupRulesConfig {
	return BackupRulesConfigSchema.parse(overrides)
}

function backup(file: string, createdAt: number): PreviousBackupInfo {
	return { filePath: path.join(DEFAULT_DIR, file), fileSize: 100, createdAt }
}

function createController(rules: BackupRulesConfig[], backupName = 'backup-1') {
	const userConfig = new FakeUserConfig()
	const db = mockDeep<DataDatabase>()
	db.createBackup.mockResolvedValue(1234)
	const variables = mockDeep<VariablesValues>()
	variables.createVariablesAndExpressionParser.mockReturnValue({
		parseVariables: () => ({ text: backupName, variableIds: new Set() }),
	} as any)
	const exportController = mockDeep<ExportController>()
	exportController.generateCustomExport.mockReturnValue({} as any)

	const controller = new BackupController(
		{ configDir: '/config' } as AppInfo,
		db,
		userConfig as unknown as DataUserConfig,
		variables,
		exportController
	)
	controller.initializeWithConfig(rules)

	return {
		controller,
		userConfig,
		db,
		exportController,
		caller: t.createCallerFactory(controller.createTrpcRouter())(testCtx),
	}
}

beforeEach(() => {
	vi.clearAllMocks()
	fsMock.mkdir.mockResolvedValue(undefined)
	// No backup file exists yet
	fsMock.access.mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }))
	fsMock.unlink.mockResolvedValue(undefined)
	cronMock.schedule.mockImplementation(() => ({ stop: vi.fn() }))
	writeExportToFile.mockResolvedValue(5678)
})

describe('BackupController', () => {
	describe('scheduling', () => {
		test('schedules the enabled rules with a valid cron expression', () => {
			createController([
				makeRule({ id: 'on', enabled: true, cron: '0 3 * * *' }),
				makeRule({ id: 'off', enabled: false }),
				makeRule({ id: 'bad', enabled: true, cron: 'every tuesday' }),
			])

			expect(cronMock.schedule).toHaveBeenCalledTimes(1)
			expect(cronMock.schedule).toHaveBeenCalledWith('0 3 * * *', expect.any(Function), { noOverlap: true })
		})

		test('reschedules when the rules change, stopping the old jobs', () => {
			const { userConfig } = createController([makeRule({ id: 'on', enabled: true })])
			const oldJob = cronMock.schedule.mock.results[0].value

			userConfig.setKeyUnchecked('backups', [makeRule({ id: 'on', enabled: true, cron: '0 4 * * *' })])

			expect(oldJob.stop).toHaveBeenCalled()
			expect(cronMock.schedule).toHaveBeenLastCalledWith('0 4 * * *', expect.any(Function), { noOverlap: true })
		})

		test('a finished backup leaves the scheduled jobs running', async () => {
			const { caller } = createController([makeRule({ id: 'on', enabled: true })])
			const job = cronMock.schedule.mock.results[0].value

			await caller.runBackupNow({ ruleId: 'on' })

			expect(job.stop).not.toHaveBeenCalled()
			expect(cronMock.schedule).toHaveBeenCalledTimes(1)
		})

		test('a scheduled run uses the rule as it is when it runs', async () => {
			const { controller, db } = createController([makeRule({ id: 'on', enabled: true, backupType: 'db' })])
			await controller.updateRuleField('on', { key: 'backupType', value: 'export-json' })
			const run = cronMock.schedule.mock.calls[cronMock.schedule.mock.calls.length - 1][1] as () => Promise<void>

			await run()

			expect(writeExportToFile).toHaveBeenCalled()
			expect(db.createBackup).not.toHaveBeenCalled()
		})

		test('a scheduled run makes a backup', async () => {
			const { db, userConfig } = createController([makeRule({ id: 'on', enabled: true })])
			const run = cronMock.schedule.mock.calls[0][1] as () => Promise<void>

			await run()

			expect(db.createBackup).toHaveBeenCalledWith(path.join(DEFAULT_DIR, 'backup-1.companiondb'))
			expect(userConfig.saved?.[0].previousBackups).toHaveLength(1)
		})
	})

	describe('createRule', () => {
		test('adds an enabled rule with the defaults, and schedules it', async () => {
			const { controller, userConfig } = createController([])

			const id = await controller.createRule('Nightly')

			expect(userConfig.saved).toEqual([
				expect.objectContaining({ id, name: 'Nightly', enabled: true, keep: 5, backupType: 'db', previousBackups: [] }),
			])
			expect(cronMock.schedule).toHaveBeenCalledTimes(1)
			expect(cronMock.schedule).toHaveBeenCalledWith('0 0 * * *', expect.any(Function), { noOverlap: true })
		})

		test('names a rule without a name', async () => {
			const { controller, userConfig } = createController([])

			await controller.createRule('')

			expect(userConfig.saved?.[0].name).toBe('New Backup Rule')
		})
	})

	describe('deleteRule', () => {
		test('removes the rule and stops its job', async () => {
			const { controller, userConfig } = createController([makeRule({ id: 'a', enabled: true }), makeRule({ id: 'b' })])
			const job = cronMock.schedule.mock.results[0].value

			expect(await controller.deleteRule('a')).toBe(true)

			expect(userConfig.saved?.map((r) => r.id)).toEqual(['b'])
			expect(job.stop).toHaveBeenCalled()
		})

		test('refuses a rule that does not exist', async () => {
			const { controller, userConfig } = createController([makeRule({ id: 'a' })])

			expect(await controller.deleteRule('missing')).toBe(false)
			expect(userConfig.saved).toBeUndefined()
		})
	})

	describe('reorderRules', () => {
		test('moves a rule to where another is', async () => {
			const { controller, userConfig } = createController([
				makeRule({ id: 'a' }),
				makeRule({ id: 'b' }),
				makeRule({ id: 'c' }),
			])

			expect(await controller.reorderRules('c', 'a')).toBe(true)

			expect(userConfig.saved?.map((r) => r.id)).toEqual(['c', 'a', 'b'])
		})

		test('refuses a rule that does not exist', async () => {
			const { controller } = createController([makeRule({ id: 'a' })])

			expect(await controller.reorderRules('a', 'missing')).toBe(false)
		})
	})

	describe('runBackupNow', () => {
		test('makes a database backup in the default folder, and records it', async () => {
			const { caller, db, userConfig } = createController([makeRule({ id: 'a' })])

			await caller.runBackupNow({ ruleId: 'a' })

			const filePath = path.join(DEFAULT_DIR, 'backup-1.companiondb')
			expect(db.createBackup).toHaveBeenCalledWith(filePath)
			expect(userConfig.saved?.[0].previousBackups).toEqual([
				{ filePath, fileSize: 1234, createdAt: expect.any(Number) },
			])
			expect(userConfig.saved?.[0].lastRan).toBeGreaterThan(0)
		})

		test.each([
			['export-json', 'json'],
			['export-yaml', 'yaml'],
			['export-gz', 'json-gz'],
		] as const)('makes a %s backup in the rule folder', async (backupType, format) => {
			const { caller, exportController } = createController([
				makeRule({ id: 'a', backupType, backupPath: '/elsewhere' }),
			])

			await caller.runBackupNow({ ruleId: 'a' })

			expect(exportController.generateCustomExport).toHaveBeenCalled()
			expect(writeExportToFile).toHaveBeenCalledWith({}, format, path.join('/elsewhere', 'backup-1.companionconfig'))
		})

		test('refuses to overwrite a backup that already exists', async () => {
			const { caller, db, userConfig } = createController([makeRule({ id: 'a' })])
			fsMock.access.mockResolvedValue(undefined)

			await expect(caller.runBackupNow({ ruleId: 'a' })).rejects.toThrow(/already exists/)
			expect(db.createBackup).not.toHaveBeenCalled()
			expect(userConfig.saved).toBeUndefined()
		})

		test('makes nothing when the name pattern gives no name', async () => {
			const { caller, db } = createController([makeRule({ id: 'a' })], '')

			await expect(caller.runBackupNow({ ruleId: 'a' })).rejects.toThrow(/No backup created/)
			expect(db.createBackup).not.toHaveBeenCalled()
		})

		test('refuses a rule that does not exist', async () => {
			const { caller } = createController([])

			await expect(caller.runBackupNow({ ruleId: 'missing' })).rejects.toThrow(/not found/)
		})

		test('deletes the oldest backups beyond the number to keep', async () => {
			const { caller, userConfig } = createController([
				makeRule({ id: 'a', keep: 2, previousBackups: [backup('old.companiondb', 1), backup('mid.companiondb', 2)] }),
			])

			await caller.runBackupNow({ ruleId: 'a' })

			await vi.waitFor(() => expect(fsMock.unlink).toHaveBeenCalledWith(path.join(DEFAULT_DIR, 'old.companiondb')))
			await vi.waitFor(() =>
				expect(userConfig.saved?.[0].previousBackups.map((b) => path.basename(b.filePath))).toEqual([
					'mid.companiondb',
					'backup-1.companiondb',
				])
			)
		})

		test('pruning does not bring back a backup deleted while it ran', async () => {
			const oldFile = path.join(DEFAULT_DIR, 'old.companiondb')
			const mid = backup('mid.companiondb', 2)
			let finishDeletingOld!: () => void
			fsMock.unlink.mockImplementation(async (file: string) => {
				if (file === oldFile) await new Promise<void>((resolve) => (finishDeletingOld = resolve))
			})
			const { caller, controller, userConfig } = createController([
				makeRule({ id: 'a', keep: 2, previousBackups: [backup('old.companiondb', 1), mid] }),
			])

			// The backup starts pruning the oldest, and the user deletes another while that is still going
			await caller.runBackupNow({ ruleId: 'a' })
			await vi.waitFor(() => expect(fsMock.unlink).toHaveBeenCalledWith(oldFile))
			expect(await controller.deleteBackup('a', mid.filePath)).toBe(true)
			finishDeletingOld()

			await vi.waitFor(() =>
				expect(userConfig.saved?.[0].previousBackups.map((b) => path.basename(b.filePath))).toEqual([
					'backup-1.companiondb',
				])
			)
		})

		test('keeps every backup when keep is 0', async () => {
			const { caller, userConfig } = createController([
				makeRule({ id: 'a', keep: 0, previousBackups: [backup('old.companiondb', 1)] }),
			])

			await caller.runBackupNow({ ruleId: 'a' })

			expect(fsMock.unlink).not.toHaveBeenCalled()
			expect(userConfig.saved?.[0].previousBackups).toHaveLength(2)
		})
	})

	describe('deleteBackup', () => {
		test('deletes one of the rule backups, and forgets it', async () => {
			const old = backup('old.companiondb', 1)
			const { controller, userConfig } = createController([
				makeRule({ id: 'a', previousBackups: [old, backup('new.companiondb', 2)] }),
			])

			expect(await controller.deleteBackup('a', old.filePath)).toBe(true)

			expect(fsMock.unlink).toHaveBeenCalledWith(old.filePath)
			expect(userConfig.saved?.[0].previousBackups.map((b) => path.basename(b.filePath))).toEqual(['new.companiondb'])
		})

		test('only deletes a file that is one of the rule backups', async () => {
			const { controller, userConfig } = createController([
				makeRule({ id: 'a', previousBackups: [backup('old.companiondb', 1)] }),
			])

			expect(await controller.deleteBackup('a', '/etc/passwd')).toBe(false)
			expect(await controller.deleteBackup('missing', path.join(DEFAULT_DIR, 'old.companiondb'))).toBe(false)

			expect(fsMock.unlink).not.toHaveBeenCalled()
			expect(userConfig.saved).toBeUndefined()
		})

		test('does not change the rule it was given', async () => {
			const old = backup('old.companiondb', 1)
			const rule = makeRule({ id: 'a', previousBackups: [old] })
			const { controller } = createController([rule])

			await controller.deleteBackup('a', old.filePath)

			expect(rule.previousBackups).toEqual([old])
		})

		test('forgets a backup whose file is already gone', async () => {
			const old = backup('old.companiondb', 1)
			const { controller, userConfig } = createController([makeRule({ id: 'a', previousBackups: [old] })])
			fsMock.unlink.mockRejectedValue(new Error('gone'))

			expect(await controller.deleteBackup('a', old.filePath)).toBe(true)
			expect(userConfig.saved?.[0].previousBackups).toEqual([])
		})
	})

	describe('updateRuleField', () => {
		test('sets a setting of a rule', async () => {
			const { controller, userConfig } = createController([makeRule({ id: 'rule1', name: 'Nightly' })])

			expect(await controller.updateRuleField('rule1', { key: 'keep', value: 10 })).toBe(true)
			expect(await controller.updateRuleField('rule1', { key: 'backupType', value: 'export-json' })).toBe(true)

			expect(userConfig.saved?.[0]).toMatchObject({
				id: 'rule1',
				name: 'Nightly',
				keep: 10,
				backupType: 'export-json',
			})
		})

		test.each([
			['an empty name', { key: 'name', value: '  ' }],
			['an invalid cron expression', { key: 'cron', value: 'every tuesday' }],
			['a negative keep', { key: 'keep', value: -1 }],
			['a fractional keep', { key: 'keep', value: 1.5 }],
			['a keep over 1000', { key: 'keep', value: 1001 }],
		] as const)('refuses %s', async (_name, change) => {
			const { controller, userConfig } = createController([makeRule({ id: 'rule1' })])

			expect(await controller.updateRuleField('rule1', change)).toBe(false)
			expect(userConfig.saved).toBeUndefined()
		})

		test('the procedure returns why it refused an invalid value, without throwing', async () => {
			const { caller, userConfig } = createController([makeRule({ id: 'rule1' })])

			expect(await caller.updateRuleField({ ruleId: 'rule1', change: { key: 'cron', value: 'every tuesday' } })).toBe(
				"'every tuesday' is not a valid cron expression"
			)
			expect(await caller.updateRuleField({ ruleId: 'rule1', change: { key: 'name', value: ' ' } })).toBe(
				'Name cannot be empty'
			)
			expect(userConfig.saved).toBeUndefined()

			expect(await caller.updateRuleField({ ruleId: 'rule1', change: { key: 'cron', value: '0 1 * * *' } })).toBeNull()
		})

		test('refuses a rule that does not exist', async () => {
			const { controller, userConfig } = createController([makeRule({ id: 'rule1' })])

			expect(await controller.updateRuleField('missing', { key: 'enabled', value: true })).toBe(false)
			expect(userConfig.saved).toBeUndefined()
		})

		test('the procedure refuses a value of the wrong type, or a field that is not a setting', async () => {
			const { caller, userConfig } = createController([makeRule({ id: 'rule1' })])

			await expect(
				caller.updateRuleField({ ruleId: 'rule1', change: { key: 'enabled', value: 'yes' } as any })
			).rejects.toThrow()
			await expect(
				caller.updateRuleField({ ruleId: 'rule1', change: { key: 'lastRan', value: 5 } as any })
			).rejects.toThrow()

			expect(userConfig.saved).toBeUndefined()
		})
	})
})
