import { describe, expect, test } from 'vitest'
import { mockDeep } from 'vitest-mock-extended'
import { CreateTriggerControlId } from '@companion-app/shared/ControlId.js'
import type {
	ExportInstancesv6,
	ExportPageContentv6,
	ExportTriggerContentv6,
} from '@companion-app/shared/Model/ExportModel.js'
import type { ClientImportOrResetSelection, ImportOrResetType } from '@companion-app/shared/Model/ImportExport.js'
import type { ControlsController } from '../../lib/Controls/Controller.js'
import type { DataUserConfig } from '../../lib/Data/UserConfig.js'
import type { GraphicsController } from '../../lib/Graphics/Controller.js'
import { ImportController } from '../../lib/ImportExport/Import.js'
import type { InstanceController } from '../../lib/Instance/Controller.js'
import type { InternalController } from '../../lib/Internal/Controller.js'
import type { PageController } from '../../lib/Page/Controller.js'
import type { SurfaceController } from '../../lib/Surface/Controller.js'
import type { VariablesController } from '../../lib/Variables/Controller.js'

// These tests drive the real ImportController against mocked leaf controllers, but keep the genuine
// fixup logic (ImportFixup + VisitorReferencesUpdater) in the loop. The focus is orchestration:
// connection remapping (create / reuse / ignore), page & trigger import, and the reset-and-import
// config gating in importFull.

const mockOptions = {
	fallbackMockImplementation: () => {
		throw new Error('not mocked')
	},
}

const DEFAULT_GRID_SIZE = { minColumn: 0, maxColumn: 7, minRow: 0, maxRow: 3 }

function pageControls(controls: ExportPageContentv6['controls']): ExportPageContentv6 {
	return { name: 'Imported Page', controls, gridSize: DEFAULT_GRID_SIZE }
}

function createImportController() {
	const controls = mockDeep<ControlsController>(mockOptions)
	const graphics = mockDeep<GraphicsController>(mockOptions)
	const instance = mockDeep<InstanceController>(mockOptions)
	const internalModule = mockDeep<InternalController>(mockOptions)
	const page = mockDeep<PageController>(mockOptions)
	const surfaces = mockDeep<SurfaceController>(mockOptions)
	const userconfig = mockDeep<DataUserConfig>(mockOptions)
	const variables = mockDeep<VariablesController>(mockOptions)

	// ── Baseline stubs shared by most paths ──
	internalModule.visitReferences.mockReturnValue(undefined)

	userconfig.getKey.mockImplementation((key: any) => {
		if (key === 'gridSize') return { ...DEFAULT_GRID_SIZE }
		return undefined
	})
	userconfig.setKey.mockReturnValue(undefined)

	controls.deleteControl.mockReturnValue(undefined)
	controls.importControl.mockReturnValue(undefined as any)
	controls.getControl.mockReturnValue(undefined)
	controls.importTrigger.mockReturnValue(undefined as any)
	controls.importExpressionVariable.mockReturnValue(undefined)
	controls.getAllControls.mockReturnValue(new Map())
	controls.replaceExpressionVariableCollections.mockReturnValue(undefined)
	controls.replaceTriggerCollections.mockReturnValue(undefined)

	graphics.clearAllForPage.mockReturnValue(undefined)
	graphics.imageLibrary.importImageLibrary.mockReturnValue(undefined)

	page.resetPage.mockReturnValue([])
	page.setPageName.mockReturnValue(undefined)
	page.store.getPageId.mockReturnValue('page-id-1')
	page.store.getPageCount.mockReturnValue(1)
	page.insertPages.mockReturnValue([])

	// Connection creation: hand back a deterministic new id derived from the requested label.
	let created = 0
	instance.addConnectionWithLabel.mockImplementation((_module: any, label: string) => {
		created++
		return [`new-conn-${created}`, { label }] as any
	})
	instance.setConnectionLabelAndConfig.mockReturnValue(undefined as any)
	instance.getLabelForConnection.mockReturnValue(undefined)
	instance.getIdForLabel.mockReturnValue(undefined)
	instance.getInstanceConfigOfType.mockReturnValue(undefined)
	instance.getSurfaceInstanceClientJson.mockReturnValue({})
	;(instance.connectionCollections as any).removeUnknownCollectionReferences = () => {}
	instance.connectionCollections.replaceCollections.mockReturnValue(undefined)
	instance.surfaceInstanceCollections.replaceCollections.mockReturnValue(undefined)

	variables.custom.replaceCollections.mockReturnValue(undefined)
	variables.custom.replaceDefinitions.mockReturnValue(undefined)

	surfaces.importSurfaces.mockReturnValue(undefined)

	const controller = new ImportController(
		controls,
		graphics,
		instance,
		internalModule,
		page,
		surfaces,
		userconfig,
		variables
	)

	return { controller, controls, graphics, instance, internalModule, page, surfaces, userconfig, variables }
}

const oneConnection: ExportInstancesv6 = {
	'old-conn': { label: 'my-connection', moduleId: 'demo-module', sortOrder: 0 },
} as any

// ── importSinglePage ────────────────────────────────────────────────────────

describe('importSinglePage', () => {
	test('creates new connections, resets the target page and imports its controls', async () => {
		const { controller, controls, graphics, instance, page } = createImportController()
		page.resetPage.mockReturnValue(['discarded-control'])

		const pageInfo = pageControls({ 0: { 0: { type: 'pagenum' } }, 1: { 2: { type: 'pageup' } } })

		const remap = await controller.importSinglePage(oneConnection, {}, pageInfo, 3)

		// A new connection was created and reported back for reuse by future imports
		expect(instance.addConnectionWithLabel).toHaveBeenCalledWith(
			{ type: 'demo-module' },
			'my-connection',
			expect.objectContaining({ disabled: true })
		)
		expect(remap['old-conn']).toBe('new-conn-1')

		// The old page was reset and its discarded controls deleted
		expect(page.resetPage).toHaveBeenCalledWith(3)
		expect(controls.deleteControl).toHaveBeenCalledWith('discarded-control')
		expect(graphics.clearAllForPage).toHaveBeenCalledWith(3)
		expect(page.setPageName).toHaveBeenCalledWith(3, 'Imported Page')

		// Both controls were imported at their locations
		expect(controls.importControl).toHaveBeenCalledWith({ pageNumber: 3, row: 0, column: 0 }, { type: 'pagenum' })
		expect(controls.importControl).toHaveBeenCalledWith({ pageNumber: 3, row: 1, column: 2 }, { type: 'pageup' })
	})

	test('reuses an existing connection when the remapping points at a live connection', async () => {
		const { controller, instance } = createImportController()
		instance.getLabelForConnection.mockReturnValue('existing-label')

		const remap = await controller.importSinglePage(oneConnection, { 'old-conn': 'existing-conn' }, pageControls({}), 2)

		// No new connection created - the existing one is reused
		expect(instance.addConnectionWithLabel).not.toHaveBeenCalled()
		expect(remap['old-conn']).toBe('existing-conn')
	})

	test('honours the _ignore remapping (connection is skipped, not created)', async () => {
		const { controller, instance } = createImportController()

		const remap = await controller.importSinglePage(oneConnection, { 'old-conn': '_ignore' }, pageControls({}), 2)

		expect(instance.addConnectionWithLabel).not.toHaveBeenCalled()
		expect(remap['old-conn']).toBe('_ignore')
	})

	test('expands the configured grid when the imported page needs a larger grid', async () => {
		const { controller, userconfig } = createImportController()
		// Page references column 10 / row 5, beyond the default 8x4 grid
		const pageInfo = pageControls({ 5: { 10: { type: 'pagenum' } } })
		pageInfo.gridSize = { minColumn: 0, maxColumn: 10, minRow: 0, maxRow: 5 }

		await controller.importSinglePage(undefined, {}, pageInfo, 2)

		expect(userconfig.setKey).toHaveBeenCalledWith('gridSize', expect.objectContaining({ maxColumn: 10, maxRow: 5 }))
	})

	test('a control-less page still imports (no controls, grid unchanged)', async () => {
		const { controller, controls, userconfig } = createImportController()

		await controller.importSinglePage(undefined, {}, pageControls({}), 2)

		expect(controls.importControl).not.toHaveBeenCalled()
		// Grid already fits -> no resize
		expect(userconfig.setKey).not.toHaveBeenCalled()
	})
})

// ── importTriggers ──────────────────────────────────────────────────────────

const oneTrigger: Record<string, ExportTriggerContentv6> = {
	t1: { type: 'trigger', options: { name: 'Trigger One' } },
}

describe('importTriggers', () => {
	test('imports selected triggers under their original id when free', () => {
		const { controller, controls } = createImportController()

		const remap = controller.importTriggers(oneConnection, {}, oneTrigger, ['t1'], false)

		expect(controls.importTrigger).toHaveBeenCalledTimes(1)
		expect(controls.importTrigger).toHaveBeenCalledWith(CreateTriggerControlId('t1'), expect.any(Object))
		expect(remap['old-conn']).toBe('new-conn-1')
	})

	test('only the selected triggers are imported', () => {
		const { controller, controls } = createImportController()
		const triggers = {
			t1: { type: 'trigger', options: { name: 'One' } } as any,
			t2: { type: 'trigger', options: { name: 'Two' } } as any,
		}

		controller.importTriggers(undefined, {}, triggers, ['t2'], false)

		expect(controls.importTrigger).toHaveBeenCalledTimes(1)
		expect(controls.importTrigger).toHaveBeenCalledWith(CreateTriggerControlId('t2'), expect.any(Object))
	})

	test('a colliding trigger id is imported under a freshly generated id', () => {
		const { controller, controls } = createImportController()
		// The original id is already taken
		controls.getControl.mockImplementation((id: string) =>
			id === CreateTriggerControlId('t1') ? ({} as any) : undefined
		)

		controller.importTriggers(undefined, {}, oneTrigger, ['t1'], false)

		const importedId = controls.importTrigger.mock.calls[0][0]
		expect(importedId).not.toBe(CreateTriggerControlId('t1'))
		expect(importedId.startsWith('trigger:')).toBe(true)
	})

	test('replaceExisting deletes existing trigger controls first', () => {
		const { controller, controls } = createImportController()
		controls.getAllControls.mockReturnValue(
			new Map<string, any>([
				['trigger:existing', { type: 'trigger' }],
				['bank:keep', { type: 'button' }],
			])
		)

		controller.importTriggers(undefined, {}, oneTrigger, ['t1'], true)

		// Only the existing trigger is deleted, not the button
		expect(controls.deleteControl).toHaveBeenCalledWith('trigger:existing')
		expect(controls.deleteControl).not.toHaveBeenCalledWith('bank:keep')
	})

	test('replaceExisting=false leaves existing controls untouched', () => {
		const { controller, controls } = createImportController()
		controls.getAllControls.mockReturnValue(new Map<string, any>([['trigger:existing', { type: 'trigger' }]]))

		controller.importTriggers(undefined, {}, oneTrigger, ['t1'], false)

		expect(controls.deleteControl).not.toHaveBeenCalled()
	})
})

// ── importFull: config gating ───────────────────────────────────────────────

function fullConfig(overrides: Partial<ClientImportOrResetSelection> = {}): ClientImportOrResetSelection {
	const all: ImportOrResetType = 'reset-and-import'
	return {
		buttons: all,
		connections: 'reset',
		surfaces: { known: all, instances: all, remote: all },
		triggers: all,
		customVariables: all,
		expressionVariables: all,
		userconfig: 'reset',
		imageLibrary: all,
		...overrides,
	}
}

describe('importFull config gating', () => {
	function baseData(): any {
		return {
			type: 'full',
			version: 12,
			instances: oneConnection,
			connectionCollections: [],
			pages: { 1: pageControls({ 0: { 0: { type: 'pagenum' } } }) },
			triggers: { t1: { type: 'trigger', options: { name: 'T' } } },
			triggerCollections: [],
			custom_variables: { v: { defaultValue: '1' } },
			customVariablesCollections: [],
			expressionVariables: {},
			expressionVariablesCollections: [],
			imageLibrary: [{ info: { name: 'i' } }],
			imageLibraryCollections: [],
		}
	}

	test('imports each enabled section', async () => {
		const { controller, controls, variables, graphics, instance } = createImportController()

		await controller.importFull(baseData(), fullConfig())

		expect(instance.addConnectionWithLabel).toHaveBeenCalled()
		expect(variables.custom.replaceDefinitions).toHaveBeenCalledWith({ v: { defaultValue: '1' } })
		expect(controls.importTrigger).toHaveBeenCalledWith(CreateTriggerControlId('t1'), expect.any(Object))
		expect(controls.importControl).toHaveBeenCalledWith({ pageNumber: 1, row: 0, column: 0 }, { type: 'pagenum' })
		expect(graphics.imageLibrary.importImageLibrary).toHaveBeenCalledWith([], [{ info: { name: 'i' } }])
	})

	test('sections set to "unchanged" are not imported', async () => {
		const { controller, controls, variables, graphics, instance } = createImportController()

		const config = fullConfig({
			buttons: 'unchanged',
			triggers: 'unchanged',
			customVariables: 'unchanged',
			expressionVariables: 'unchanged',
			imageLibrary: 'unchanged',
			surfaces: { known: 'unchanged', instances: 'unchanged', remote: 'unchanged' },
		})

		await controller.importFull(baseData(), config)

		expect(controls.importControl).not.toHaveBeenCalled()
		expect(controls.importTrigger).not.toHaveBeenCalled()
		expect(variables.custom.replaceDefinitions).not.toHaveBeenCalled()
		expect(graphics.imageLibrary.importImageLibrary).not.toHaveBeenCalled()
		// Connections are always imported (they are referenced by everything else)
		expect(instance.addConnectionWithLabel).toHaveBeenCalled()
	})

	test('connections "unchanged" merges collections and reuses connections matching by label+module', async () => {
		const { controller, instance } = createImportController()
		// An existing connection with the same label and module exists -> reuse it, don't create
		instance.getIdForLabel.mockReturnValue('existing-conn')
		instance.getInstanceConfigOfType.mockReturnValue({ moduleId: 'demo-module' } as any)
		instance.getLabelForConnection.mockReturnValue('my-connection')

		const config = fullConfig({
			connections: 'unchanged',
			buttons: 'unchanged',
			triggers: 'unchanged',
			customVariables: 'unchanged',
			expressionVariables: 'unchanged',
			imageLibrary: 'unchanged',
			surfaces: { known: 'unchanged', instances: 'unchanged', remote: 'unchanged' },
		})

		await controller.importFull(baseData(), config)

		// merge mode -> replaceCollections called with merge=true
		expect(instance.connectionCollections.replaceCollections).toHaveBeenCalledWith([], true)
		// existing connection reused, so nothing new created
		expect(instance.addConnectionWithLabel).not.toHaveBeenCalled()
	})

	test('inserts pages when the import references a page beyond the current count', async () => {
		const { controller, page } = createImportController()

		const data = baseData()
		data.pages = { 3: pageControls({}) } // page 3 with only 1 page existing

		await controller.importFull(
			data,
			fullConfig({
				connections: 'reset',
				triggers: 'unchanged',
				customVariables: 'unchanged',
				expressionVariables: 'unchanged',
				imageLibrary: 'unchanged',
				surfaces: { known: 'unchanged', instances: 'unchanged', remote: 'unchanged' },
			})
		)

		// Needs to grow from 1 page to 3 -> insert 2 pages
		expect(page.insertPages).toHaveBeenCalledWith(2, ['Page', 'Page'])
	})
})
