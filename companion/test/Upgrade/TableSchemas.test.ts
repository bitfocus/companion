import fs from 'fs-extra'
import { describe, expect, test } from 'vitest'
import type z from 'zod'
import { SomeControlModelSchema } from '@companion-app/shared/Model/Controls.js'
import { CustomVariableDefinitionSchema } from '@companion-app/shared/Model/CustomVariableModel.js'
import { SomeEntityModelSchema } from '@companion-app/shared/Model/EntityModel.js'
import { InstanceConfigSchema } from '@companion-app/shared/Model/Instance.js'
import { PageModelSchema } from '@companion-app/shared/Model/PageModel.js'
import { SomeButtonGraphicsElementSchema } from '@companion-app/shared/Model/StyleLayersModel.js'
import { OutboundSurfaceInfoSchema, SurfaceConfigSchema } from '@companion-app/shared/Model/Surfaces.js'
import { createTables } from '../../lib/Data/Schema/v1.js'
import { DataStoreBase } from '../../lib/Data/StoreBase.js'
import { upgradeStartup } from '../../lib/Data/Upgrade.js'
import { importTable } from './util.js'

// Upgrade each fixture of a real old database to the current version, and check that every row of a schema-backed
// table parses without losing anything, so a schema can't be stricter than the data users really have.

const FIXTURES = [
	'v1tov2/db.v1.json',
	'v1tov5/db.v1.json',
	'v2tov3/db.v2.json',
	'v3tov4/db.v3.json',
	'v4tov5/db.v4.json',
]

const SCHEMA_TABLES: {
	table: string
	schema: z.ZodType
	hasFixtureRows: boolean
	/** Paths of old fields the schema deliberately drops, which may be missing after parsing */
	dropped?: string[]
}[] = [
	{ table: 'custom_variables', schema: CustomVariableDefinitionSchema, hasFixtureRows: true },
	{ table: 'pages', schema: PageModelSchema, hasFixtureRows: true },
	{ table: 'instances', schema: InstanceConfigSchema, hasFixtureRows: true },
	{
		table: 'surfaces',
		schema: SurfaceConfigSchema,
		hasFixtureRows: true,
		// Migrated into the group config
		dropped: ['page', 'config.page', 'config.use_last_page', 'groupConfig.page'],
	},
	// No fixture has any remote surfaces
	{ table: 'surfaces_remote', schema: OutboundSurfaceInfoSchema, hasFixtureRows: false },
]

class FixtureDatabase extends DataStoreBase<any> {
	constructor(fixture: string) {
		super(':memory:', '', 'main', 'Data/Database', () => {})
		this.startSQLite()

		importTable(this.defaultTableView, fs.readJsonSync(`./companion/test/Upgrade/${fixture}`))
		upgradeStartup(this)
	}
	protected create(): void {
		createTables(this.store, this.defaultTable, this.logger)
	}
	protected loadDefaults(): void {}
	protected migrateFileToSqlite(): void {}
}

const upgradedRows = FIXTURES.map((fixture) => {
	const db = new FixtureDatabase(fixture)
	const rows = Object.fromEntries(SCHEMA_TABLES.map(({ table }) => [table, db.getTableView(table).all()]))
	const controls = db.getTableView<Record<string, unknown>>('controls').all()
	db.close()
	return { fixture, rows, controls }
})

/** The outermost entities within a value; their children are parsed with them */
function collectEntities(value: unknown, found: unknown[] = []): unknown[] {
	if (Array.isArray(value)) {
		for (const item of value) collectEntities(item, found)
	} else if (value && typeof value === 'object') {
		const record = value as Record<string, unknown>
		if ((record.type === 'action' || record.type === 'feedback') && 'definitionId' in record) {
			found.push(record)
		} else {
			for (const child of Object.values(record)) collectEntities(child, found)
		}
	}
	return found
}

// The controls table isn't schema-backed yet, but the schemas of its parts can already be checked
describe('entities in controls', () => {
	// Feedbacks used as trigger conditions kept the style of the old button feedbacks, which nothing reads
	const droppedEntityFields = ['style']

	test.each(upgradedRows)('every entity of $fixture parses, losing nothing', ({ controls }) => {
		for (const [controlId, control] of Object.entries(controls)) {
			for (const entity of collectEntities(control)) {
				const result = SomeEntityModelSchema.safeParse(entity)
				expect(result.error, `entity in "${controlId}"`).toBeUndefined()
				expect(result.data, `entity in "${controlId}"`).toMatchObject(
					withoutPaths(entity, droppedEntityFields) as object
				)
			}
		}
	})

	test('are covered by the fixtures', () => {
		const entityCount = upgradedRows.reduce(
			(count, { controls }) => count + Object.values(controls).flatMap((control) => collectEntities(control)).length,
			0
		)
		expect(entityCount).toBeGreaterThan(0)
	})
})

describe('controls', () => {
	// Page buttons converted from old versions kept the empty fields of a normal button, which nothing reads
	const droppedPageButtonFields = ['feedbacks', 'options', 'steps', 'style']
	const pageButtonTypes = new Set(['pagenum', 'pageup', 'pagedown'])

	/** A copy of a control without the old fields its schema drops */
	function withoutDroppedFields(control: unknown): unknown {
		const type = (control as { type: string }).type
		const copy = withoutPaths(control, pageButtonTypes.has(type) ? droppedPageButtonFields : [])

		// Feedbacks used as trigger conditions kept the style of the old button feedbacks, which nothing reads
		const stripEntityStyles = (value: unknown): void => {
			if (Array.isArray(value)) {
				for (const item of value) stripEntityStyles(item)
			} else if (value && typeof value === 'object') {
				const record = value as Record<string, unknown>
				if (record.type === 'feedback' && 'definitionId' in record) delete record.style
				for (const child of Object.values(record)) stripEntityStyles(child)
			}
		}
		stripEntityStyles(copy)

		return copy
	}

	test.each(upgradedRows)('every control of $fixture parses, losing nothing', ({ controls }) => {
		for (const [controlId, control] of Object.entries(controls)) {
			const result = SomeControlModelSchema.safeParse(control)
			expect(result.error, `control "${controlId}"`).toBeUndefined()
			expect(result.data, `control "${controlId}"`).toMatchObject(withoutDroppedFields(control) as object)
		}
	})

	test.each(['button-layered', 'trigger'])('include %s controls', (type) => {
		const count = upgradedRows.reduce(
			(total, { controls }) =>
				total +
				Object.values(controls).filter((control) => (control as { type?: string } | null)?.type === type).length,
			0
		)
		expect(count).toBeGreaterThan(0)
	})
})

// The elements of each layered button's style, with their children parsed with them
describe('style elements in controls', () => {
	function collectElements(controls: Record<string, unknown>): [controlId: string, element: unknown][] {
		return Object.entries(controls).flatMap(([controlId, control]) => {
			const layers = (control as { style?: { layers?: unknown } } | null)?.style?.layers
			return Array.isArray(layers) ? layers.map((element): [string, unknown] => [controlId, element]) : []
		})
	}

	test.each(upgradedRows)('every element of $fixture parses, losing nothing', ({ controls }) => {
		for (const [controlId, element] of collectElements(controls)) {
			const result = SomeButtonGraphicsElementSchema.safeParse(element)
			expect(result.error, `element in "${controlId}"`).toBeUndefined()
			expect(result.data, `element in "${controlId}"`).toMatchObject(element as object)
		}
	})

	test('are covered by the fixtures', () => {
		const elementCount = upgradedRows.reduce((count, { controls }) => count + collectElements(controls).length, 0)
		expect(elementCount).toBeGreaterThan(0)
	})
})

/** A copy of the row without the given dotted paths */
function withoutPaths(row: unknown, paths: string[]): unknown {
	const copy = structuredClone(row)
	for (const path of paths) {
		const keys = path.split('.')
		const parent = keys.slice(0, -1).reduce<any>((value, key) => value?.[key], copy)
		if (parent && typeof parent === 'object') delete parent[keys[keys.length - 1]]
	}
	return copy
}

describe.each(SCHEMA_TABLES)('$table', ({ table, schema, hasFixtureRows, dropped }) => {
	test.each(upgradedRows)('every row of $fixture parses, losing nothing', ({ rows }) => {
		for (const [id, row] of Object.entries(rows[table])) {
			const result = schema.safeParse(row)
			expect(result.error, `row "${id}"`).toBeUndefined()
			// Defaults may be added, but nothing in the row may be dropped
			expect(result.data, `row "${id}"`).toMatchObject(withoutPaths(row, dropped ?? []) as object)
		}
	})

	test.runIf(hasFixtureRows)('is covered by the fixtures', () => {
		const rowCount = upgradedRows.reduce((count, { rows }) => count + Object.keys(rows[table]).length, 0)
		expect(rowCount).toBeGreaterThan(0)
	})
})
