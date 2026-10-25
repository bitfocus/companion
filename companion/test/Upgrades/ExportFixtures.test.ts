import fs from 'fs-extra'
import { describe, expect, test } from 'vitest'
import { SomeExportSchema } from '@companion-app/shared/Model/Export/Latest.js'
import { UserConfigModelSchema } from '@companion-app/shared/Model/UserConfigModel.js'
import LogController from '../../lib/Log/Controller.js'
import { LEGACY_VERSION, legacyUpgrades } from '../../lib/Upgrades/LegacyUpgrades.js'
import { upgradeImport } from '../../lib/Upgrades/UpgradeExport.js'

// Import each fixture of a real old export, and check that parsing it with the export schema loses nothing from what
// the legacy upgrade steps make of it, so the schema can't be stricter than the exports users really have.

const FIXTURES = ['v2-page-loupedeck-live.json', 'v9-full-contour-shuttle.json']

const userConfig = UserConfigModelSchema.parse({})
const logger = LogController.createLogger('test-logger')

/** The export as the legacy steps upgrade it, before the schema parses it */
function upgradeWithLegacySteps(raw: any): any {
	let obj = structuredClone(raw)
	for (let i = obj.version || 1; i < LEGACY_VERSION; i++) {
		obj = legacyUpgrades[i - 1].upgradeImport(obj, logger, userConfig)
	}
	return obj
}

const fixtures = FIXTURES.map((fixture) => {
	const raw = fs.readJsonSync(`./companion/test/Upgrades/Exports/${fixture}`)
	return { fixture, raw, legacy: upgradeWithLegacySteps(raw) }
})

/** A copy of the export without the given dotted paths, where `*` matches every key */
function withoutPaths(obj: any, paths: string[]): any {
	const copy = structuredClone(obj)
	const remove = (value: any, keys: string[]): void => {
		if (!value || typeof value !== 'object') return
		const [key, ...rest] = keys
		const targets = key === '*' ? Object.keys(value) : [key]
		for (const target of targets) {
			if (rest.length === 0) delete value[target]
			else remove(value[target], rest)
		}
	}
	for (const path of paths) remove(copy, path.split('.'))
	return copy
}

// Written by the legacy steps or old versions, but read by nothing
const droppedPaths = [
	'orig_version',
	// The page of a surface from before groups, which the db upgrades already moved into its group config
	'surfaces.*.groupConfig.page',
	// Feedbacks converted from old buttons kept their style, which nothing reads
	...['pages.*.controls', 'page.controls'].flatMap((controls) => [
		`${controls}.*.*.feedbacks.*.style`,
		`${controls}.*.*.localVariables.*.style`,
	]),
]

describe('old exports', () => {
	test.each(fixtures)('$fixture imports', ({ raw }) => {
		expect(() => upgradeImport(structuredClone(raw), userConfig)).not.toThrow()
	})

	// Compared with the same output of the legacy steps, as they generate new ids
	test.each(fixtures)('parsing $fixture loses nothing', ({ legacy }) => {
		const parsed = SomeExportSchema.parse(structuredClone(legacy))
		// As JSON, which can't hold an undefined property
		expect(parsed).toMatchObject(JSON.parse(JSON.stringify(withoutPaths(legacy, droppedPaths))))
	})

	test.each(fixtures)('the instances of $fixture stay as minimal or full as they were', ({ legacy }) => {
		const parsed: any = SomeExportSchema.parse(structuredClone(legacy))

		for (const key of ['instances', 'surfaceInstances']) {
			for (const [id, instance] of Object.entries<any>(legacy[key] ?? {})) {
				expect('config' in parsed[key][id], `${key}.${id}`).toBe('config' in instance)
				expect('secrets' in parsed[key][id], `${key}.${id}`).toBe('secrets' in instance)
			}
		}
	})

	// None of them have any connections yet
	test('cover full and page exports', () => {
		expect(new Set(fixtures.map(({ legacy }) => legacy.type))).toEqual(new Set(['full', 'page']))
	})
})
