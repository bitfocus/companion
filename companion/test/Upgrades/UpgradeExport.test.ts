import { describe, expect, test } from 'vitest'
import { LayeredButtonModelSchema } from '@companion-app/shared/Model/ButtonModel.js'
import { INVALID_ENTITY_DEFINITION_ID } from '@companion-app/shared/Model/EntityModel.js'
import { EXPORT_VERSION } from '@companion-app/shared/Model/Export/Latest.js'
import { UserConfigModelSchema } from '@companion-app/shared/Model/UserConfigModel.js'
import { LEGACY_VERSION } from '../../lib/Upgrades/LegacyUpgrades.js'
import { DATA_VERSION } from '../../lib/Upgrades/UpgradeData.js'
import { upgradeImport } from '../../lib/Upgrades/UpgradeExport.js'

const userConfig = UserConfigModelSchema.parse({})
const gridSize = { minColumn: 0, maxColumn: 7, minRow: 0, maxRow: 3 }

const layeredButton = LayeredButtonModelSchema.parse({
	type: 'button-layered',
	options: { stepProgression: 'auto', rotaryActions: false, canModifyStyleInApis: false },
	feedbacks: [],
	steps: { '0': { action_sets: { down: [], up: [] }, options: { runWhileHeld: [] } } },
	localVariables: [],
	style: {
		layers: [
			{ id: 'canvas', type: 'canvas', name: 'Canvas', usage: 'automatic' },
			{
				id: 'text',
				type: 'text',
				name: 'Text',
				usage: 'automatic',
				fontsize: { isExpression: false, value: 14 },
				fontsizeAllowShrink: { isExpression: false, value: true },
				pinnedProperties: ['text'],
			},
		],
	},
})

describe('upgradeImport', () => {
	test('the db and export versions continue separately from the legacy steps', () => {
		expect(EXPORT_VERSION).toBeGreaterThanOrEqual(LEGACY_VERSION)
		expect(DATA_VERSION).toBeGreaterThanOrEqual(LEGACY_VERSION)
	})

	test('the export schemas start where the legacy steps end', () => {
		const page = { type: 'page', version: LEGACY_VERSION, page: { name: 'P', controls: {}, gridSize } }

		expect(upgradeImport(page, userConfig)).toMatchObject({ type: 'page', version: EXPORT_VERSION })
	})

	test('an export of the current version is only stamped', () => {
		const page = {
			type: 'page',
			version: EXPORT_VERSION,
			page: { name: 'P', controls: { 0: { 0: layeredButton } }, gridSize },
		}

		expect(upgradeImport(structuredClone(page), userConfig)).toEqual(page)
	})

	test('an old export is upgraded through the legacy steps, and stamped with the export version', () => {
		const result = upgradeImport({ type: 'full', version: 6, instances: {}, pages: {} }, userConfig)

		expect(result).toMatchObject({ type: 'full', version: EXPORT_VERSION })
	})

	// Exports were stamped with a fixed version of 12 while the format moved on, so their content is newer than their
	// version claims. The legacy steps leave content that is already upgraded alone
	test('an export stamped with the old fixed version keeps its newer content', () => {
		const page = { type: 'page', version: 12, page: { name: 'P', controls: { 0: { 0: layeredButton } }, gridSize } }

		const result = upgradeImport(structuredClone(page), userConfig)

		expect(result).toEqual({ ...page, version: EXPORT_VERSION })
	})

	test('fills in what an envelope may leave out', () => {
		const result = upgradeImport({ type: 'page', version: EXPORT_VERSION, page: {} }, userConfig)

		expect(result).toEqual({ type: 'page', version: EXPORT_VERSION, page: { name: '', controls: {} } })
	})

	test('drops the unknown parts of an envelope, as an older Companion would', () => {
		const result = upgradeImport(
			{ type: 'full', version: EXPORT_VERSION, pages: {}, somethingNew: { added: 'later' } },
			userConfig
		)

		expect(result).toEqual({ type: 'full', version: EXPORT_VERSION, pages: {} })
	})

	test('keeps a minimal instance minimal, and a full one full', () => {
		const minimal = { moduleId: 'bmd-atem', label: 'atem', lastUpgradeIndex: 3, sortOrder: 1 }
		const full = { ...minimal, config: { host: '1.2.3.4' }, secrets: { password: 'x' }, enabled: false }

		const page: any = upgradeImport(
			{ type: 'page', version: EXPORT_VERSION, page: {}, instances: { a: minimal } },
			userConfig
		)
		expect(page.instances.a).toEqual({ ...minimal, updatePolicy: 'stable' })

		const fullExport: any = upgradeImport({ type: 'full', version: EXPORT_VERSION, instances: { a: full } }, userConfig)
		expect(fullExport.instances.a).toEqual({ ...full, updatePolicy: 'stable' })
	})

	test('gives an instance whose config is not a JSON object the module default', () => {
		const instance = { moduleId: 'bmd-atem', label: 'atem', config: 'host=1.2.3.4', secrets: { password: 'x' } }

		const result: any = upgradeImport({ type: 'full', version: EXPORT_VERSION, instances: { a: instance } }, userConfig)
		expect(result.instances.a).not.toHaveProperty('config')
		expect(result.instances.a).toMatchObject({ secrets: { password: 'x' } })
	})

	test('keeps nested collections, enabling those from before they could be disabled', () => {
		const result: any = upgradeImport(
			{
				type: 'full',
				version: EXPORT_VERSION,
				connectionCollections: [
					{ id: 'a', label: 'A', sortOrder: 0, metaData: {}, children: [{ id: 'b', label: 'B', sortOrder: 0 }] },
				],
				customVariablesCollections: [{ id: 'c', label: 'C', sortOrder: 1, metaData: null, children: [] }],
			},
			userConfig
		)

		expect(result.connectionCollections).toEqual([
			{
				id: 'a',
				label: 'A',
				sortOrder: 0,
				metaData: { enabled: true },
				children: [{ id: 'b', label: 'B', sortOrder: 0, metaData: { enabled: true }, children: [] }],
			},
		])
		expect(result.customVariablesCollections).toEqual([
			{ id: 'c', label: 'C', sortOrder: 1, metaData: null, children: [] },
		])
	})

	test('keeps custom and expression variables, filling in what they may leave out', () => {
		const entity = {
			type: 'feedback',
			id: 'f1',
			definitionId: 'expression',
			connectionId: 'internal',
			options: { expression: { isExpression: false, value: '1 + 1' } },
		}
		const result: any = upgradeImport(
			{
				type: 'full',
				version: EXPORT_VERSION,
				custom_variables: { counter: { description: 'Counts', defaultValue: 5 } },
				expressionVariables: { e1: { type: 'expression-variable', options: { variableName: 'sum' }, entity } },
			},
			userConfig
		)

		expect(result.custom_variables.counter).toEqual({
			description: 'Counts',
			defaultValue: 5,
			persistCurrentValue: false,
			sortOrder: 0,
		})
		expect(result.expressionVariables.e1).toMatchObject({
			options: { variableName: 'sum' },
			entity,
			localVariables: [],
		})
	})

	test('leaves out what a surface or group config left out, as the import applies them field by field', () => {
		const result: any = upgradeImport(
			{
				type: 'full',
				version: EXPORT_VERSION,
				surfaces: { s1: { config: { brightness: 50, custom: 'x' }, groupConfig: { name: 'Auto', last_page: 3 } } },
				surfaceGroups: { g1: { name: 'Group', startup_page: 2, allowed_pages: [1, 2] } },
			},
			userConfig
		)

		expect(result.surfaces).toEqual({
			s1: { config: { brightness: 50, custom: 'x' }, groupConfig: { name: 'Auto', last_page: 3 } },
		})
		expect(result.surfaceGroups).toEqual({ g1: { name: 'Group', startup_page: 2, allowed_pages: [1, 2] } })
	})

	test('skips a remote surface that is invalid, keeping the others', () => {
		const remote = { id: 'r1', type: 'plugin', moduleId: 'satellite', instanceId: 'i1' }
		const result: any = upgradeImport(
			{ type: 'full', version: EXPORT_VERSION, surfacesRemote: { r1: remote, r2: { id: 'r2', type: 'other' } } },
			userConfig
		)

		expect(result.surfacesRemote.r1).toMatchObject(remote)
		expect(result.surfacesRemote.r2).toBeUndefined()
	})

	test('skips an image that is invalid, keeping the others', () => {
		const image = { info: { name: 'logo' }, originalImage: 'data:image/png;base64,AA', previewImage: 'data:,' }
		const result: any = upgradeImport(
			{ type: 'full', version: EXPORT_VERSION, imageLibrary: [image, { info: {} }] },
			userConfig
		)

		expect(result.imageLibrary).toEqual([{ ...image, info: expect.objectContaining({ name: 'logo', sortOrder: 0 }) }])
	})

	describe('repairs', () => {
		const feedback = { type: 'feedback', id: 'f1', definitionId: 'state', connectionId: 'conn1', options: {} }
		const action = { type: 'action', id: 'a1', definitionId: 'send', connectionId: 'conn1', options: {} }
		const placeholder = { connectionId: 'internal', definitionId: INVALID_ENTITY_DEFINITION_ID, disabled: true }

		test('replaces an invalid entity of a page control, keeping the rest of the page', () => {
			const button = { ...layeredButton, feedbacks: [feedback, { ...feedback, id: 'f2', connectionId: 5 }] }
			const result: any = upgradeImport(
				{
					type: 'page',
					version: EXPORT_VERSION,
					page: { name: 'P', controls: { 0: { 0: button, 1: { type: 'pageup' } } }, gridSize },
				},
				userConfig
			)

			const feedbacks = result.page.controls[0][0].feedbacks
			expect(feedbacks[0]).toMatchObject({ id: 'f1', definitionId: 'state' })
			expect(feedbacks[1]).toMatchObject({ id: 'f2', ...placeholder })
			expect(result.page.controls[0][1]).toEqual({ type: 'pageup' })
		})

		test('skips a control that cannot be repaired, keeping the others', () => {
			const result: any = upgradeImport(
				{
					type: 'full',
					version: EXPORT_VERSION,
					pages: { 1: { name: 'P', controls: { 0: { 0: { type: 'sparkle' }, 1: { type: 'pagenum' } } } } },
				},
				userConfig
			)

			expect(result.pages[1].controls[0]).toEqual({ 1: { type: 'pagenum' } })
		})

		test('repairs or skips a trigger', () => {
			const trigger = { type: 'trigger', options: { name: 'T' }, actions: [action] }
			const result: any = upgradeImport(
				{
					type: 'trigger_list',
					version: EXPORT_VERSION,
					triggers: {
						t1: { ...trigger, actions: [{ ...action, options: 'none' }] },
						t2: { ...trigger, options: { enabled: 'sometimes' } },
						t3: trigger,
					},
				},
				userConfig
			)

			expect(result.triggers.t1.actions[0]).toMatchObject({ id: 'a1', ...placeholder })
			expect(result.triggers.t2).toBeUndefined()
			expect(result.triggers.t3.actions[0]).toMatchObject({ id: 'a1', definitionId: 'send' })
		})

		test('replaces an invalid entity of an expression variable, or a page variable', () => {
			const result: any = upgradeImport(
				{
					type: 'full',
					version: EXPORT_VERSION,
					expressionVariables: { e1: { type: 'expression-variable', entity: { ...feedback, options: [] } } },
					pages: { 1: { name: 'P', pageVariables: [feedback, { ...feedback, id: 'f2', definitionId: 3 }] } },
				},
				userConfig
			)

			expect(result.expressionVariables.e1.entity).toMatchObject({ id: 'f1', ...placeholder })
			expect(result.pages[1].pageVariables[0]).toMatchObject({ id: 'f1', definitionId: 'state' })
			expect(result.pages[1].pageVariables[1]).toMatchObject({ id: 'f2', ...placeholder })
		})

		test('resets an invalid property of an entry to its default, or drops an entry that is still invalid', () => {
			const result: any = upgradeImport(
				{
					type: 'full',
					version: EXPORT_VERSION,
					custom_variables: { counter: { description: 'Counts', sortOrder: 'first' } },
					instances: { good: { moduleId: 'bmd-atem', label: 'atem' }, bad: { label: 'no module' } },
					surfaceInstances: 'not a record',
				},
				userConfig
			)

			expect(result.custom_variables.counter).toMatchObject({ description: 'Counts', sortOrder: 0 })
			expect(Object.keys(result.instances)).toEqual(['good'])
			expect(result).not.toHaveProperty('surfaceInstances')
		})

		test('leaves out an invalid field of a surface or group, as the import applies them field by field', () => {
			const result: any = upgradeImport(
				{
					type: 'full',
					version: EXPORT_VERSION,
					surfaces: { s1: { name: 'Deck', config: { brightness: 'bright', custom: 1 } } },
					surfaceGroups: { g1: { name: 'Group', allowed_pages: [1, 'two'], never_lock: true } },
				},
				userConfig
			)

			expect(result.surfaces.s1).toEqual({ name: 'Deck', config: { custom: 1 } })
			expect(result.surfaceGroups.g1).toEqual({ name: 'Group', never_lock: true })
		})

		test('keeps the children of a collection that is dropped', () => {
			const child = { id: 'child', label: 'Child', sortOrder: 0, metaData: { enabled: true }, children: [] }
			const result: any = upgradeImport(
				{
					type: 'full',
					version: EXPORT_VERSION,
					connectionCollections: [
						{ label: 'No id', children: [child] },
						{ id: 'other', label: 5, children: [] },
					],
				},
				userConfig
			)

			expect(result.connectionCollections).toEqual([
				child,
				{ id: 'other', label: '', sortOrder: 0, metaData: { enabled: true }, children: [] },
			])
		})

		test('repairs the fields of a page, rather than failing a page export', () => {
			const result: any = upgradeImport(
				{ type: 'page', version: EXPORT_VERSION, page: { name: 7, gridSize: 'big', controls: {} } },
				userConfig
			)

			expect(result.page).toEqual({ name: '', controls: {} })
		})
	})

	test('refuses an export that is not a valid envelope', () => {
		expect(() => upgradeImport({ type: 'sparkle', version: EXPORT_VERSION }, userConfig)).toThrow(/Invalid export/)
		expect(() => upgradeImport({ type: 'page', version: EXPORT_VERSION }, userConfig)).toThrow(/Invalid export/)
		expect(() => upgradeImport({ type: 'full', version: 'new' }, userConfig)).toThrow(/Invalid export version/)
	})

	test('refuses an export from a newer version of Companion', () => {
		expect(() => upgradeImport({ type: 'full', version: EXPORT_VERSION + 1 }, userConfig)).toThrow(
			/newer version of Companion/
		)
	})
})
