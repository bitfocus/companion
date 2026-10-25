import { describe, expect, test } from 'vitest'
import { UserConfigModelSchema } from '@companion-app/shared/Model/UserConfigModel.js'
import { LEGACY_VERSION } from '../../lib/Upgrades/LegacyUpgrades.js'
import { DATA_VERSION } from '../../lib/Upgrades/UpgradeData.js'
import { EXPORT_VERSION, upgradeImport } from '../../lib/Upgrades/UpgradeExport.js'

const userConfig = UserConfigModelSchema.parse({})

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

	test('an export of the current version is only stamped', () => {
		const page = { type: 'page', version: EXPORT_VERSION, page: { name: 'P', controls: { 0: { 0: layeredButton } } } }

		expect(upgradeImport(structuredClone(page), userConfig)).toEqual(page)
	})

	test('an old export is upgraded through the legacy steps, and stamped with the export version', () => {
		const result = upgradeImport({ type: 'full', version: 6, instances: {}, pages: {} }, userConfig)

		expect(result).toMatchObject({ type: 'full', version: EXPORT_VERSION })
	})

	// Exports were stamped with a fixed version of 12 while the format moved on, so their content is newer than their
	// version claims. The legacy steps leave content that is already upgraded alone
	test('an export stamped with the old fixed version keeps its newer content', () => {
		const page = { type: 'page', version: 12, page: { name: 'P', controls: { 0: { 0: layeredButton } } } }

		const result = upgradeImport(structuredClone(page), userConfig)

		expect(result).toEqual({ ...page, version: EXPORT_VERSION })
	})

	test('refuses an export from a newer version of Companion', () => {
		expect(() => upgradeImport({ type: 'full', version: EXPORT_VERSION + 1 }, userConfig)).toThrow(
			/newer version of Companion/
		)
	})
})
