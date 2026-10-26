import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import z from 'zod'
import { EXPORT_VERSION, ExportSchemaByVersion } from '../Latest.js'
import { findSchemaIncompatibilities } from './SchemaCompatibility.js'

// Each version of the export format is snapshotted as the JSON schema of what it accepts. A change that isn't
// compatible, such as removing or retyping a property, or making one required, fails: it needs a new version, with a
// migration from this one. A compatible change, such as an added optional property, updates the snapshot.

const SNAPSHOT_DIR = fileURLToPath(new URL('./snapshots', import.meta.url))

describe('export format', () => {
	test('the latest version has a schema', () => {
		expect(ExportSchemaByVersion[EXPORT_VERSION]).toBeDefined()
	})

	test.each(Object.entries(ExportSchemaByVersion))('version %s only changes compatibly', (version, schema) => {
		const snapshotPath = path.join(SNAPSHOT_DIR, `v${version}.json`)
		const current = z.toJSONSchema(schema, { io: 'input' })
		const currentText = JSON.stringify(current, null, '\t') + '\n'

		// A Windows checkout can have CRLF line endings
		const snapshotText = fs.existsSync(snapshotPath)
			? fs.readFileSync(snapshotPath, 'utf8').replaceAll('\r\n', '\n')
			: undefined
		if (snapshotText !== undefined) {
			const incompatibilities = findSchemaIncompatibilities(JSON.parse(snapshotText), current)
			expect(
				incompatibilities,
				`Export version ${version} changed incompatibly. Add a new version, with a migration from this one`
			).toEqual([])
		}

		if (snapshotText === currentText) return
		if (process.env.CI) {
			throw new Error(`The snapshot of export version ${version} is out of date. Run the tests locally to update it`)
		}
		fs.mkdirSync(SNAPSHOT_DIR, { recursive: true })
		fs.writeFileSync(snapshotPath, currentText)
	})
})
