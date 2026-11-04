import { initTRPC } from '@trpc/server'
import { beforeEach, describe, expect, test } from 'vitest'
import { mockDeep } from 'vitest-mock-extended'
import { BackupRulesConfigSchema, type BackupRulesConfig } from '@companion-app/shared/Model/UserConfigModel.js'
import type { DataDatabase } from '../../lib/Data/Database.js'
import type { DataUserConfig } from '../../lib/Data/UserConfig.js'
import { BackupController } from '../../lib/ImportExport/Backups.js'
import type { ExportController } from '../../lib/ImportExport/Export.js'
import type { AppInfo } from '../../lib/Registry.js'
import type { TrpcContext } from '../../lib/UI/TRPC.js'
import type { VariablesValues } from '../../lib/Variables/Values.js'
import { createMockTrpcContext } from '../Util.js'

const t = initTRPC.context<TrpcContext>().create()
const testCtx: TrpcContext = createMockTrpcContext()

function createController() {
	const userConfig = mockDeep<DataUserConfig>()
	const controller = new BackupController(
		{ configDir: '/config' } as AppInfo,
		mockDeep<DataDatabase>(),
		userConfig,
		mockDeep<VariablesValues>(),
		mockDeep<ExportController>()
	)
	// A disabled rule, so nothing is scheduled
	const rule = BackupRulesConfigSchema.parse({ id: 'rule1', name: 'Nightly' })
	controller.initializeWithConfig([rule])

	return { controller, userConfig, caller: t.createCallerFactory(controller.createTrpcRouter())(testCtx) }
}

/** The rules the controller saved last */
function savedRules(userConfig: ReturnType<typeof createController>['userConfig']): BackupRulesConfig[] | undefined {
	const calls = userConfig.setKeyUnchecked.mock.calls.filter(([key]) => key === 'backups')
	return calls[calls.length - 1]?.[1] as BackupRulesConfig[] | undefined
}

describe('BackupController updateRuleField', () => {
	let controller: BackupController
	let userConfig: ReturnType<typeof createController>['userConfig']
	let caller: ReturnType<typeof createController>['caller']

	beforeEach(() => {
		;({ controller, userConfig, caller } = createController())
	})

	test('sets a setting of a rule', async () => {
		expect(await controller.updateRuleField('rule1', { key: 'keep', value: 10 })).toBe(true)
		expect(await controller.updateRuleField('rule1', { key: 'backupType', value: 'export-json' })).toBe(true)

		expect(savedRules(userConfig)?.[0]).toMatchObject({
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
		expect(await controller.updateRuleField('rule1', change)).toBe(false)
		expect(savedRules(userConfig)).toBeUndefined()
	})

	test('refuses a rule that does not exist', async () => {
		expect(await controller.updateRuleField('missing', { key: 'enabled', value: true })).toBe(false)
		expect(savedRules(userConfig)).toBeUndefined()
	})

	test('the procedure refuses a value of the wrong type, or a field that is not a setting', async () => {
		await expect(
			caller.updateRuleField({ ruleId: 'rule1', change: { key: 'enabled', value: 'yes' } as any })
		).rejects.toThrow()
		await expect(
			caller.updateRuleField({ ruleId: 'rule1', change: { key: 'lastRan', value: 5 } as any })
		).rejects.toThrow()

		expect(savedRules(userConfig)).toBeUndefined()
	})
})
