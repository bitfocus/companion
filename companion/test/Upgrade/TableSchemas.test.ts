import fs from 'fs-extra'
import { describe, expect, test } from 'vitest'
import type z from 'zod'
import { CustomVariableDefinitionSchema } from '@companion-app/shared/Model/CustomVariableModel.js'
import { InstanceConfigSchema } from '@companion-app/shared/Model/Instance.js'
import { PageModelSchema } from '@companion-app/shared/Model/PageModel.js'
import { OutboundSurfaceInfoSchema } from '@companion-app/shared/Model/Surfaces.js'
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

const SCHEMA_TABLES: { table: string; schema: z.ZodType; hasFixtureRows: boolean }[] = [
	{ table: 'custom_variables', schema: CustomVariableDefinitionSchema, hasFixtureRows: true },
	{ table: 'pages', schema: PageModelSchema, hasFixtureRows: true },
	{ table: 'instances', schema: InstanceConfigSchema, hasFixtureRows: true },
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
	db.close()
	return { fixture, rows }
})

describe.each(SCHEMA_TABLES)('$table', ({ table, schema, hasFixtureRows }) => {
	test.each(upgradedRows)('every row of $fixture parses, losing nothing', ({ rows }) => {
		for (const [id, row] of Object.entries(rows[table])) {
			const result = schema.safeParse(row)
			expect(result.error, `row "${id}"`).toBeUndefined()
			// Defaults may be added, but nothing in the row may be dropped
			expect(result.data, `row "${id}"`).toMatchObject(row as object)
		}
	})

	test.runIf(hasFixtureRows)('is covered by the fixtures', () => {
		const rowCount = upgradedRows.reduce((count, { rows }) => count + Object.keys(rows[table]).length, 0)
		expect(rowCount).toBeGreaterThan(0)
	})
})
