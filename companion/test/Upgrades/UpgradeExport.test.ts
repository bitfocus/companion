import { describe, expect, test } from 'vitest'
import { EXPORT_VERSION } from '@companion-app/shared/Model/Export/Latest.js'
import { UserConfigModelSchema } from '@companion-app/shared/Model/UserConfigModel.js'
import { LEGACY_VERSION } from '../../lib/Upgrades/LegacyUpgrades.js'
import { DATA_VERSION } from '../../lib/Upgrades/UpgradeData.js'
import { upgradeImport } from '../../lib/Upgrades/UpgradeExport.js'

const userConfig = UserConfigModelSchema.parse({})
const gridSize = { minColumn: 0, maxColumn: 7, minRow: 0, maxRow: 3 }

const layeredButton = {
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
}

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
