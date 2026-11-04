import { initTRPC } from '@trpc/server'
import { beforeEach, describe, expect, test } from 'vitest'
import { mockDeep } from 'vitest-mock-extended'
import { createTables } from '../../lib/Data/Schema/v1.js'
import { DataStoreBase } from '../../lib/Data/StoreBase.js'
import { SurfaceController } from '../../lib/Surface/Controller.js'
import type { SurfaceHandlerDependencies } from '../../lib/Surface/Types.js'
import type { TrpcContext } from '../../lib/UI/TRPC.js'
import { createMockTrpcContext } from '../Util.js'
import { mockGetKey } from '../utils/MockUserConfig.js'

const t = initTRPC.context<TrpcContext>().create()
const testCtx: TrpcContext = createMockTrpcContext()

class TestDatabase extends DataStoreBase<any> {
	constructor() {
		super(':memory:', '', 'main', 'Data/Database', () => {})
		this.startSQLite()
	}
	protected create(): void {
		createTables(this.store, this.defaultTable, this.logger)
	}
	protected loadDefaults(): void {}
	protected migrateFileToSqlite(): void {}
}

function createController() {
	const db = new TestDatabase()
	const deps = mockDeep<SurfaceHandlerDependencies>({ fallbackMockImplementation: () => undefined })
	deps.userconfig.getKey.mockImplementation(
		mockGetKey({ gridSize: { minColumn: 0, maxColumn: 7, minRow: 0, maxRow: 3 } }, 'default')
	)
	// Pages 1 to 3 exist
	deps.pageStore.getFirstPageId.mockReturnValue('page-1')
	deps.pageStore.isPageIdValid.mockImplementation((id) => ['page-1', 'page-2', 'page-3'].includes(id))

	const controller = new SurfaceController(db as any, deps, true)
	return { controller, caller: t.createCallerFactory(controller.createTrpcRouter())(testCtx) }
}

describe('surface group config', () => {
	let controller: SurfaceController
	let caller: ReturnType<typeof createController>['caller']

	beforeEach(() => {
		;({ controller, caller } = createController())
	})

	describe('importSurfaces', () => {
		test('sets the settings that are valid, and skips the rest', () => {
			controller.importSurfaces(
				{
					'group:desk': {
						name: 'Desk',
						never_lock: true,
						startup_page_id: 'page-2',
						// Not a boolean
						restrict_pages: 1,
						// Not a page
						last_page_id: 'page-9',
						// Not a setting
						sparkle: true,
					},
				},
				{}
			)

			const group = controller.exportAllGroups()['group:desk' as any]
			expect(group).toMatchObject({ name: 'Desk', never_lock: true, startup_page_id: 'page-2', restrict_pages: false })
			expect(group.last_page_id).not.toBe('page-9')
			expect(group).not.toHaveProperty('sparkle')
		})
	})

	describe('groupSetConfigKey', () => {
		beforeEach(async () => {
			await caller.groupAdd({ baseId: 'desk', name: 'Desk' })
		})

		test('sets a setting of a group', async () => {
			await caller.groupSetConfigKey({ groupId: 'group:desk', change: { key: 'never_lock', value: true } })
			await caller.groupSetConfigKey({ groupId: 'group:desk', change: { key: 'allowed_page_ids', value: ['page-2'] } })

			expect(controller.exportAllGroups()['group:desk' as any]).toMatchObject({
				never_lock: true,
				allowed_page_ids: ['page-2'],
			})
		})

		test('refuses a page that does not exist', async () => {
			const result = await caller.groupSetConfigKey({
				groupId: 'group:desk',
				change: { key: 'startup_page_id', value: 'page-9' },
			})

			expect(result).toBe('invalid value')
			expect(controller.exportAllGroups()['group:desk' as any].startup_page_id).not.toBe('page-9')
		})

		test('refuses a value of the wrong type, or a key that is not a setting', async () => {
			await expect(
				caller.groupSetConfigKey({ groupId: 'group:desk', change: { key: 'never_lock', value: 'yes' } as any })
			).rejects.toThrow()
			await expect(
				caller.groupSetConfigKey({ groupId: 'group:desk', change: { key: 'name', value: 'Renamed' } as any })
			).rejects.toThrow()

			expect(controller.exportAllGroups()['group:desk' as any]).toMatchObject({ name: 'Desk', never_lock: false })
		})

		test('refuses a group that does not exist', async () => {
			await expect(
				caller.groupSetConfigKey({ groupId: 'group:missing', change: { key: 'never_lock', value: true } })
			).rejects.toThrow(/Group does not exist/)
		})
	})
})
