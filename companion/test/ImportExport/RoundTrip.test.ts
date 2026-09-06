import zlib from 'node:zlib'
import Express from 'express'
import supertest from 'supertest'
import { describe, expect, test } from 'vitest'
import { mockDeep } from 'vitest-mock-extended'
import { CreateExpressionVariableControlId, CreateTriggerControlId } from '@companion-app/shared/ControlId.js'
import type { ExportFormat } from '@companion-app/shared/Model/ExportFormat.js'
import type { ControlsController } from '../../lib/Controls/Controller.js'
import type { DataUserConfig } from '../../lib/Data/UserConfig.js'
import type { GraphicsController } from '../../lib/Graphics/Controller.js'
import { FILE_VERSION } from '../../lib/ImportExport/Constants.js'
import { ExportController } from '../../lib/ImportExport/Export.js'
import { parseImportBuffer, type ParseImportResult } from '../../lib/ImportExport/ParseImport.js'
import { ImportExportThreadMethods } from '../../lib/ImportExport/ThreadMethods.js'
import { prepareExport, streamExport } from '../../lib/ImportExport/Util.js'
import type { InstanceController } from '../../lib/Instance/Controller.js'
import type { IPageStore } from '../../lib/Page/Store.js'
import type { AppInfo } from '../../lib/Registry.js'
import type { SurfaceController } from '../../lib/Surface/Controller.js'
import type { VariablesController } from '../../lib/Variables/Controller.js'

// These tests exercise the real download → parse pipeline end-to-end: a config is exported (through
// the actual serialisation used by the download route), then fed back through the real import parser
// (parseImportBuffer, with the genuine worker YAML path invoked inline). This is the contract that
// matters to a user: the bytes Companion hands you as a download must parse back into the same object.

const mockOptions = {
	fallbackMockImplementation: () => {
		throw new Error('not mocked')
	},
}

const DEFAULT_GRID_SIZE = { minColumn: 0, maxColumn: 7, minRow: 0, maxRow: 3 }
const ALL_FORMATS: ExportFormat[] = ['json', 'json-gz', 'yaml']

// The real YAML path runs in a worker via ImportExportThreadMethods.parseImportData. Call it inline
// (no worker spawn) so the JSON-vs-YAML routing is exercised against the actual parser.
const parseYaml = async (buffer: Buffer, gz: boolean): Promise<ParseImportResult> =>
	ImportExportThreadMethods.parseImportData(
		buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
		gz
	)

/** A control whose exported JSON is a fixed object, plus the reference-collector the export walks. */
function makeControl(json: unknown, type = 'button-layered') {
	return {
		type,
		toJSON: () => json,
		collectReferencedConnectionsAndVariables: () => {},
	} as any
}

function makeTrigger(triggerId: string, name: string) {
	return {
		controlId: CreateTriggerControlId(triggerId),
		options: { name },
		toJSON: () => ({ type: 'trigger', options: { name }, actions: [], feedbacks: [] }),
		collectReferencedConnectionsAndVariables: () => {},
	} as any
}

function makeExpressionVariable(variableId: string, expression: string) {
	return {
		controlId: CreateExpressionVariableControlId(variableId),
		toJSON: () => ({ type: 'expression-variable', expression }),
		collectReferencedConnectionsAndVariables: () => {},
	} as any
}

/**
 * Build an ExportController backed by a representative, fully-populated config: a page with a button,
 * a trigger, an expression variable, a connection, surfaces (known/remote/instances) and image
 * library data. Everything is plain JSON so it survives a serialise → parse round-trip unchanged.
 */
function createExportController() {
	const appInfo = { appBuild: 'roundtrip-build', appVersion: '4.0.0', machineId: 'm1' } as unknown as AppInfo

	const controls = mockDeep<ControlsController>(mockOptions)
	const graphics = mockDeep<GraphicsController>(mockOptions)
	const instance = mockDeep<InstanceController>(mockOptions)
	const pageStore = mockDeep<IPageStore>(mockOptions)
	const surfaces = mockDeep<SurfaceController>(mockOptions)
	const userconfig = mockDeep<DataUserConfig>(mockOptions)
	const variables = mockDeep<VariablesController>(mockOptions)

	const buttonJson = {
		type: 'button-layered',
		style: { layers: [{ type: 'text', text: 'Hello', size: 14 }] },
		options: { relativeDelay: false },
	}

	const pageOne = { id: 'page-1', name: 'Page One', controls: { 0: { 0: 'control-1' } } } as any
	pageStore.getAll.mockReturnValue({ 1: pageOne })
	pageStore.getPageInfo.mockImplementation((pageNumber: number) => (pageNumber === 1 ? pageOne : undefined))
	pageStore.getPageNumber.mockReturnValue(1)

	controls.getControl.mockImplementation((id: string) => {
		if (id === 'control-1') return makeControl(buttonJson)
		return undefined // page control (page:<id>) etc. -> no local variables
	})
	controls.getAllTriggers.mockReturnValue([makeTrigger('trig-1', 'My Trigger')])
	controls.exportTriggerCollections.mockReturnValue([
		{ id: 'tc1', label: 'Triggers', children: [], sortOrder: 0 } as any,
	])
	controls.getAllExpressionVariables.mockReturnValue([makeExpressionVariable('ev-1', '1 + 1')])
	controls.exportExpressionVariableCollections.mockReturnValue([])

	instance.exportAllConnections.mockReturnValue({
		'conn-1': {
			label: 'my-connection',
			moduleId: 'demo-module',
			moduleVersionId: '1.0.0',
			isFirstInit: false,
			config: { host: '127.0.0.1' },
			lastUpgradeIndex: 2,
			sortOrder: 0,
		},
	} as any)
	;(instance.connectionCollections as any).collectionData = [
		{ id: 'cc1', label: 'Connections', children: [], sortOrder: 0 },
	]
	instance.exportAllSurfaceInstances.mockReturnValue({
		'si-1': { moduleId: 'surface-mod', label: 'surface-1', sortOrder: 0 },
	} as any)
	;(instance.surfaceInstanceCollections as any).collectionData = []

	surfaces.exportAll.mockReturnValue({
		'surface-1': {
			type: 'test',
			integrationType: 'test',
			groupConfig: { last_page_id: 'page-1', startup_page_id: 'page-1' },
		},
	} as any)
	surfaces.exportAllGroups.mockReturnValue({
		'group-1': { last_page_id: 'page-1', startup_page_id: 'page-1' },
	} as any)
	surfaces.exportAllRemote.mockReturnValue({
		'remote-1': { id: 'remote-1', instanceId: 'si-1', moduleId: 'surface-mod', name: 'Remote' },
	} as any)

	userconfig.getKey.mockImplementation((key: any) => {
		if (key === 'gridSize') return DEFAULT_GRID_SIZE
		if (key === 'default_export_filename') return 'companion-config'
		return undefined
	})

	variables.custom.getDefinitions.mockReturnValue({
		myvar: { description: 'A var', defaultValue: '42', sortOrder: 0, persistCurrentValue: false },
	})
	variables.custom.exportCollections.mockReturnValue([])
	variables.values.createVariablesAndExpressionParser.mockReturnValue({
		parseVariables: (text: string) => ({ text }),
	} as any)

	graphics.imageLibrary.exportImageLibraryData.mockReturnValue([
		{ info: { name: 'logo', collectionId: undefined }, data: 'c2hvcnQtYmFzZTY0' } as any,
	])
	graphics.imageLibrary.exportCollections.mockReturnValue([])

	const apiRouter = Express.Router()
	const controller = new ExportController(
		appInfo,
		apiRouter,
		controls,
		graphics,
		instance,
		pageStore,
		surfaces,
		userconfig,
		variables
	)

	const app = Express()
	app.use('/int/api', apiRouter)
	app.use((_req, res) => res.status(404).send('not found'))

	return { app, controller }
}

/** Serialise an export object exactly as the download route does for the given format. */
async function serialiseAsDownload(data: any, format: ExportFormat): Promise<Buffer> {
	const prepared = prepareExport(data, format)
	if (prepared.kind === 'buffer') {
		return Buffer.from(prepared.data as any)
	}

	// Streamed (json / json-gz): collect the chunks the same way the HTTP response would.
	const chunks: Buffer[] = []
	const sink = new (await import('node:stream')).Writable({
		write(chunk: Buffer, _enc, cb) {
			chunks.push(Buffer.from(chunk))
			cb()
		},
	})
	await streamExport(data, prepared.format, sink)
	return Buffer.concat(chunks)
}

/** Collect a binary HTTP response body into a Buffer (supertest otherwise parses text/json). */
function binaryParser(res: any, callback: (err: Error | null, body: Buffer) => void): void {
	const chunks: Buffer[] = []
	res.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)))
	res.on('end', () => callback(null, Buffer.concat(chunks)))
}

function download(app: Express.Express, url: string) {
	return supertest(app).get(url).buffer(true).parse(binaryParser)
}

describe('export/import round-trip', () => {
	// ── generateCustomExport: strong equality against the source object ──────────

	describe('generateCustomExport serialise → parse preserves the object', () => {
		for (const format of ALL_FORMATS) {
			test(`format=${format} round-trips to an identical object`, async () => {
				const { controller } = createExportController()
				const exp = controller.generateCustomExport(null)

				const bytes = await serialiseAsDownload(exp, format)
				const result = await parseImportBuffer(bytes, parseYaml)

				expect(result.error).toBeNull()
				expect(result.data).toEqual(exp)
			})
		}

		test('the exported object actually contains every major section', () => {
			const { controller } = createExportController()
			const exp = controller.generateCustomExport(null) as any

			// Guard against a future refactor silently emptying the fixture (which would make the
			// round-trip assertions vacuous).
			expect(exp.type).toBe('full')
			expect(exp.version).toBe(FILE_VERSION)
			expect(Object.keys(exp.pages)).toHaveLength(1)
			expect(exp.pages[1].controls[0][0].type).toBe('button-layered')
			expect(Object.keys(exp.triggers)).toContain('trig-1')
			expect(Object.keys(exp.expressionVariables)).toContain('ev-1')
			expect(exp.custom_variables.myvar).toBeDefined()
			expect(exp.instances['conn-1'].label).toBe('my-connection')
			expect(exp.surfaces['surface-1']).toBeDefined()
			expect(exp.surfacesRemote['remote-1']).toBeDefined()
			expect(exp.surfaceInstances['si-1']).toBeDefined()
			expect(exp.imageLibrary).toHaveLength(1)
		})
	})

	// ── download endpoints: all three formats parse back to the same object ──────

	describe('every download format parses back to the same object', () => {
		const endpoints = [
			{ name: 'full', url: '/int/api/export/full', type: 'full' },
			{ name: 'trigger list', url: '/int/api/export/triggers/all', type: 'trigger_list' },
			{ name: 'single page', url: '/int/api/export/page/1', type: 'page' },
		]

		for (const endpoint of endpoints) {
			test(`${endpoint.name} export is format-equivalent and parses`, async () => {
				const { app } = createExportController()

				const parsed: Record<string, unknown> = {}
				for (const format of ALL_FORMATS) {
					const res = await download(app, `${endpoint.url}?format=${format}`)
					expect(res.status).toBe(200)

					const result = await parseImportBuffer(res.body, parseYaml)
					expect(result.error, `format=${format}`).toBeNull()
					parsed[format] = result.data
				}

				// All three download formats must decode to exactly the same object
				expect(parsed['json']).toEqual(parsed['json-gz'])
				expect(parsed['json']).toEqual(parsed['yaml'])

				// ...and it must be a well-formed export of the expected type
				expect((parsed['json'] as any).type).toBe(endpoint.type)
				expect((parsed['json'] as any).version).toBe(FILE_VERSION)
			})
		}
	})

	// ── a gzipped export is recognised by its magic bytes and parsed as JSON ─────

	test('a downloaded json-gz export is gzip and gunzips to matching JSON', async () => {
		const { app } = createExportController()
		const res = await download(app, '/int/api/export/full?format=json-gz')

		expect(res.body[0]).toBe(0x1f)
		expect(res.body[1]).toBe(0x8b)

		const viaParser = await parseImportBuffer(res.body, parseYaml)
		const viaGunzip = JSON.parse(zlib.gunzipSync(res.body).toString('utf-8'))
		expect(viaParser.data).toEqual(viaGunzip)
	})
})
