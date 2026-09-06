import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import Express from 'express'
import { unzipSync } from 'fflate'
import supertest from 'supertest'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { mockDeep } from 'vitest-mock-extended'
import yaml from 'yaml'
import { CreateTriggerControlId } from '@companion-app/shared/ControlId.js'
import type { ControlsController } from '../../lib/Controls/Controller.js'
import type { ControlTrigger } from '../../lib/Controls/ControlTypes/Triggers/Trigger.js'
import type { DataUserConfig } from '../../lib/Data/UserConfig.js'
import type { GraphicsController } from '../../lib/Graphics/Controller.js'
import { FILE_VERSION } from '../../lib/ImportExport/Constants.js'
import { ExportController } from '../../lib/ImportExport/Export.js'
import type { InstanceController } from '../../lib/Instance/Controller.js'
import LogController from '../../lib/Log/Controller.js'
import type { IPageStore } from '../../lib/Page/Store.js'
import type { AppInfo } from '../../lib/Registry.js'
import type { SurfaceController } from '../../lib/Surface/Controller.js'
import type { VariablesController } from '../../lib/Variables/Controller.js'

const mockOptions = {
	fallbackMockImplementation: () => {
		throw new Error('not mocked')
	},
}

const DEFAULT_EXPORT_FILENAME = 'companion-config'
const DEFAULT_GRID_SIZE = { minColumn: 0, maxColumn: 7, minRow: 0, maxRow: 3 }

/**
 * supertest parses text/json by default; export downloads are binary (gzip/zip) or
 * `application/octet-stream`, so collect the raw bytes into a Buffer instead.
 */
function binaryParser(res: any, callback: (err: Error | null, body: Buffer) => void): void {
	const chunks: Buffer[] = []
	res.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)))
	res.on('end', () => callback(null, Buffer.concat(chunks)))
}

/** Decode a downloaded export body back into the original object, per the requested format. */
function decodeExport(body: Buffer, format: 'json' | 'json-gz' | 'yaml' | undefined): any {
	if (format === 'json') return JSON.parse(body.toString('utf-8'))
	if (format === 'yaml') return yaml.parse(body.toString('utf-8'))
	// json-gz and the default
	return JSON.parse(zlib.gunzipSync(body).toString('utf-8'))
}

/** Build a minimal but valid mock trigger control. */
function makeTrigger(triggerId: string, name: string, collectionId?: string): ControlTrigger {
	return {
		controlId: CreateTriggerControlId(triggerId),
		options: { name, collectionId },
		toJSON: () => ({ type: 'trigger', options: { name } }),
		collectReferencedConnectionsAndVariables: () => {},
	} as unknown as ControlTrigger
}

describe('ExportController', () => {
	function createController(configDir = '/tmp/does-not-exist') {
		const appInfo = {
			appBuild: 'test-build-1',
			appVersion: '4.0.0',
			machineId: 'test-machine-id',
			configDir,
			logsDir: undefined,
		} as unknown as AppInfo

		const controls = mockDeep<ControlsController>(mockOptions)
		const graphics = mockDeep<GraphicsController>(mockOptions)
		const instance = mockDeep<InstanceController>(mockOptions)
		const pageStore = mockDeep<IPageStore>(mockOptions)
		const surfaces = mockDeep<SurfaceController>(mockOptions)
		const userconfig = mockDeep<DataUserConfig>(mockOptions)
		const variables = mockDeep<VariablesController>(mockOptions)

		// ── Sensible "empty companion" defaults; individual tests override as needed ──
		controls.getAllTriggers.mockReturnValue([])
		controls.getTrigger.mockReturnValue(undefined)
		controls.getControl.mockReturnValue(undefined)
		controls.exportTriggerCollections.mockReturnValue([])
		controls.getAllExpressionVariables.mockReturnValue([])
		controls.exportExpressionVariableCollections.mockReturnValue([])

		graphics.imageLibrary.exportImageLibraryData.mockReturnValue([])
		graphics.imageLibrary.exportCollections.mockReturnValue([])

		instance.exportAllConnections.mockReturnValue({})
		instance.exportAllSurfaceInstances.mockReturnValue({})
		instance.getIdForLabel.mockReturnValue(undefined)
		instance.exportConnection.mockReturnValue({} as any)
		;(instance.connectionCollections as any).collectionData = []
		;(instance.surfaceInstanceCollections as any).collectionData = []

		pageStore.getAll.mockReturnValue({})
		pageStore.getPageInfo.mockReturnValue(undefined)
		pageStore.getPageNumber.mockReturnValue(null)

		surfaces.exportAll.mockReturnValue({})
		surfaces.exportAllGroups.mockReturnValue({})
		surfaces.exportAllRemote.mockReturnValue({})

		userconfig.getKey.mockImplementation((key: any) => {
			if (key === 'default_export_filename') return DEFAULT_EXPORT_FILENAME
			if (key === 'gridSize') return DEFAULT_GRID_SIZE
			return undefined
		})

		variables.custom.getDefinitions.mockReturnValue({})
		variables.custom.exportCollections.mockReturnValue([])
		// The filename parser echoes the input text back unchanged.
		variables.values.createVariablesAndExpressionParser.mockReturnValue({
			parseVariables: (text: string) => ({ text }),
		} as any)

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
		// Fallthrough for `next()` (unmatched routes) so those resolve to 404 rather than hanging.
		app.use((_req, res) => res.status(404).send('not found'))

		return { app, controller, appInfo, controls, graphics, instance, pageStore, surfaces, userconfig, variables }
	}

	function get(app: Express.Express, url: string) {
		return supertest(app).get(url).buffer(true).parse(binaryParser)
	}

	// ── Download format handling (downloadBlob) ─────────────────────────────────

	describe('download format handling', () => {
		test('defaults to streamed json-gz when no format is given', async () => {
			const { app } = createController()
			const res = await get(app, '/int/api/export/triggers/all')

			expect(res.status).toBe(200)
			expect(res.headers['content-type']).toBe('application/octet-stream')
			// gzip magic bytes
			expect(res.body[0]).toBe(0x1f)
			expect(res.body[1]).toBe(0x8b)

			const decoded = decodeExport(res.body, 'json-gz')
			expect(decoded).toMatchObject({ type: 'trigger_list', version: FILE_VERSION })
		})

		test('format=json-gz streams gzip that round-trips', async () => {
			const { app } = createController()
			const res = await get(app, '/int/api/export/triggers/all?format=json-gz')

			expect(res.status).toBe(200)
			expect(res.body[0]).toBe(0x1f)
			const decoded = decodeExport(res.body, 'json-gz')
			expect(decoded.type).toBe('trigger_list')
		})

		test('format=json returns a tab-indented buffer', async () => {
			const { app } = createController()
			const res = await get(app, '/int/api/export/triggers/all?format=json')

			expect(res.status).toBe(200)
			const text = res.body.toString('utf-8')
			// Pretty-printed with tabs, not gzipped
			expect(text).toContain('\n')
			expect(text).toContain('\t')
			expect(decodeExport(res.body, 'json')).toMatchObject({ type: 'trigger_list' })
		})

		test('format=yaml returns a yaml buffer', async () => {
			const { app } = createController()
			const res = await get(app, '/int/api/export/triggers/all?format=yaml')

			expect(res.status).toBe(200)
			const text = res.body.toString('utf-8')
			expect(text).toContain('type: trigger_list')
			expect(decodeExport(res.body, 'yaml')).toMatchObject({ type: 'trigger_list', version: FILE_VERSION })
		})

		test('an unrecognised format falls back to json-gz', async () => {
			const { app } = createController()
			const res = await get(app, '/int/api/export/triggers/all?format=bson')

			expect(res.status).toBe(200)
			expect(res.body[0]).toBe(0x1f)
			expect(res.body[1]).toBe(0x8b)
		})

		test('sets an attachment content-disposition with ascii and utf-8 filenames', async () => {
			const { app } = createController()
			const res = await get(app, '/int/api/export/triggers/all?filename=my-export')

			expect(res.headers['content-disposition']).toContain('attachment;')
			expect(res.headers['content-disposition']).toContain('filename="my-export.companionconfig"')
			expect(res.headers['content-disposition']).toContain("filename*=UTF-8''my-export.companionconfig")
		})
	})

	// ── Filename generation ─────────────────────────────────────────────────────

	describe('filename generation', () => {
		test('a custom filename is used verbatim without an export-type suffix', async () => {
			const { app } = createController()
			const res = await get(app, '/int/api/export/triggers/all?filename=custom-name')

			expect(res.headers['content-disposition']).toContain('filename="custom-name.companionconfig"')
		})

		test('the default filename gets the export type appended', async () => {
			const { app } = createController()
			// filename matching the configured default → treated as "still using the default"
			const res = await get(app, `/int/api/export/triggers/all?filename=${DEFAULT_EXPORT_FILENAME}`)

			expect(res.headers['content-disposition']).toContain(
				`filename="${DEFAULT_EXPORT_FILENAME}_trigger_list.companionconfig"`
			)
		})

		test('an empty/undefined filename falls back to hostname_timestamp_type', async () => {
			const { app } = createController()
			const res = await get(app, '/int/api/export/triggers/all')

			const disposition = res.headers['content-disposition']
			// hostname_<timestamp>_trigger_list.companionconfig
			expect(disposition).toMatch(new RegExp(`filename="${os.hostname()}_.*_trigger_list\\.companionconfig"`))
		})

		test('variables in the filename are parsed', async () => {
			const { app, variables } = createController()
			variables.values.createVariablesAndExpressionParser.mockReturnValue({
				parseVariables: () => ({ text: 'parsed-value' }),
			} as any)

			const res = await get(app, '/int/api/export/triggers/all?filename=$(internal:foo)')
			expect(res.headers['content-disposition']).toContain('filename="parsed-value.companionconfig"')
		})
	})

	// ── Trigger list export ─────────────────────────────────────────────────────

	describe('trigger list export', () => {
		test('exports all triggers with the expected envelope', async () => {
			const { app, controls } = createController()
			controls.getAllTriggers.mockReturnValue([makeTrigger('trig1', 'My Trigger')])

			const res = await get(app, '/int/api/export/triggers/all?format=json')
			const exp = decodeExport(res.body, 'json')

			expect(exp).toMatchObject({
				type: 'trigger_list',
				version: FILE_VERSION,
				companionBuild: 'test-build-1',
			})
			expect(exp.triggers.trig1).toMatchObject({ type: 'trigger', options: { name: 'My Trigger' } })
			expect(exp.instances).toEqual({})
			expect(exp.triggerCollections).toEqual([])
		})

		test('includeSecrets defaults to true and is forwarded to exportConnection', async () => {
			const { app, controls, instance } = createController()
			const trigger = makeTrigger('trig1', 'Trig')
			trigger.collectReferencedConnectionsAndVariables = (ids: Set<string>) => {
				ids.add('conn-1')
			}
			controls.getAllTriggers.mockReturnValue([trigger])

			await get(app, '/int/api/export/triggers/all?format=json')
			expect(instance.exportConnection).toHaveBeenCalledWith('conn-1', false, true, true)
		})

		test('includeSecrets=false is forwarded to exportConnection', async () => {
			const { app, controls, instance } = createController()
			const trigger = makeTrigger('trig1', 'Trig')
			trigger.collectReferencedConnectionsAndVariables = (ids: Set<string>) => {
				ids.add('conn-1')
			}
			controls.getAllTriggers.mockReturnValue([trigger])

			await get(app, '/int/api/export/triggers/all?format=json&includeSecrets=false')
			expect(instance.exportConnection).toHaveBeenCalledWith('conn-1', false, true, false)
		})

		test('ignores the internal connection', async () => {
			const { app, controls, instance } = createController()
			const trigger = makeTrigger('trig1', 'Trig')
			trigger.collectReferencedConnectionsAndVariables = (ids: Set<string>) => {
				ids.add('internal')
			}
			controls.getAllTriggers.mockReturnValue([trigger])

			const res = await get(app, '/int/api/export/triggers/all?format=json')
			expect(instance.exportConnection).not.toHaveBeenCalled()
			expect(decodeExport(res.body, 'json').instances).toEqual({})
		})
	})

	// ── Single trigger export ───────────────────────────────────────────────────

	describe('single trigger export', () => {
		test('exports a single trigger and derives the filename from its name', async () => {
			const { app, controls } = createController()
			controls.getTrigger.mockReturnValue(makeTrigger('trig1', 'Cool Trigger'))

			const res = await get(app, '/int/api/export/triggers/single/trig1?format=json')

			expect(res.status).toBe(200)
			const exp = decodeExport(res.body, 'json')
			expect(exp.type).toBe('trigger_list')
			expect(exp.triggers.trig1).toBeDefined()
			// Name is lowercased with all non-word chars stripped → "cooltrigger"
			expect(res.headers['content-disposition']).toContain('trigger_cooltrigger.companionconfig')
		})

		test('all non-word characters are stripped from the derived trigger filename', async () => {
			const { app, controls } = createController()
			controls.getTrigger.mockReturnValue(makeTrigger('trig1', 'My Cool Trigger! (v2)'))

			const res = await get(app, '/int/api/export/triggers/single/trig1?format=json')

			// Every \W removed, not just the first - lower-cased and concatenated
			expect(res.headers['content-disposition']).toContain('trigger_mycooltriggerv2.companionconfig')
		})

		test('a single trigger export never includes collections', async () => {
			const { app, controls } = createController()
			controls.getTrigger.mockReturnValue(makeTrigger('trig1', 'Trig', 'collection-1'))

			const res = await get(app, '/int/api/export/triggers/single/trig1?format=json')
			expect(decodeExport(res.body, 'json').triggerCollections).toEqual([])
			// getTrigger path must not fetch trigger collections
			expect(controls.exportTriggerCollections).not.toHaveBeenCalled()
		})

		test('a missing trigger falls through to a 404', async () => {
			const { app, controls } = createController()
			controls.getTrigger.mockReturnValue(undefined)

			const res = await get(app, '/int/api/export/triggers/single/nope')
			expect(res.status).toBe(404)
		})
	})

	// ── Single page export ──────────────────────────────────────────────────────

	describe('single page export', () => {
		test('exports a page envelope', async () => {
			const { app, pageStore } = createController()
			pageStore.getPageInfo.mockReturnValue({ id: 'page-uuid-1', name: 'Page One', controls: {} })

			const res = await get(app, '/int/api/export/page/1?format=json')
			expect(res.status).toBe(200)

			const exp = decodeExport(res.body, 'json')
			expect(exp).toMatchObject({
				type: 'page',
				version: FILE_VERSION,
				companionBuild: 'test-build-1',
				oldPageNumber: 1,
			})
			expect(exp.page).toMatchObject({ id: 'page-uuid-1', name: 'Page One' })
			expect(exp.page.gridSize).toEqual(DEFAULT_GRID_SIZE)
			expect(pageStore.getPageInfo).toHaveBeenCalledWith(1, true)
		})

		test('a non-numeric page falls through to a 404', async () => {
			const { app } = createController()
			const res = await get(app, '/int/api/export/page/abc')
			expect(res.status).toBe(404)
		})

		test('a missing page results in a 500', async () => {
			const { app, pageStore } = createController()
			pageStore.getPageInfo.mockReturnValue(undefined)

			const res = await get(app, '/int/api/export/page/9')
			expect(res.status).toBe(500)
		})

		test('the export filename is derived from the page number', async () => {
			const { app, pageStore } = createController()
			pageStore.getPageInfo.mockReturnValue({ id: 'p2', name: 'P2', controls: {} })

			const res = await get(app, '/int/api/export/page/2?filename=page2')
			expect(res.headers['content-disposition']).toContain('filename="page2.companionconfig"')
		})
	})

	// ── Custom export ───────────────────────────────────────────────────────────

	describe('custom export', () => {
		const validQuery =
			'buttons=true&connections=true&triggers=true&customVariables=true&expressionVariables=true' +
			'&includeSecrets=true&imageLibrary=true&surfaces.known=true&surfaces.instances=true&surfaces.remote=true&format=json'

		test('rejects an invalid selection with a 400 and zod issues', async () => {
			const { app } = createController()
			// Missing all the required boolean fields
			const res = await supertest(app).get('/int/api/export/custom?format=json')

			expect(res.status).toBe(400)
			expect(res.body.error).toBe('Invalid query parameters')
			expect(Array.isArray(res.body.details)).toBe(true)
		})

		test('a valid selection produces a full export', async () => {
			const { app } = createController()
			const res = await get(app, `/int/api/export/custom?${validQuery}`)

			expect(res.status).toBe(200)
			const exp = decodeExport(res.body, 'json')
			expect(exp).toMatchObject({ type: 'full', version: FILE_VERSION })
			expect(exp.pages).toBeDefined()
			expect(exp.triggers).toBeDefined()
			expect(exp.instances).toBeDefined()
		})

		test('deselecting sections omits them from the export', async () => {
			const { app } = createController()
			const query =
				'buttons=false&connections=false&triggers=false&customVariables=false&expressionVariables=false' +
				'&includeSecrets=false&imageLibrary=false&surfaces.known=false&surfaces.instances=false&surfaces.remote=false&format=json'

			const res = await get(app, `/int/api/export/custom?${query}`)
			const exp = decodeExport(res.body, 'json')

			expect(exp.pages).toBeUndefined()
			expect(exp.triggers).toBeUndefined()
			expect(exp.custom_variables).toBeUndefined()
			expect(exp.surfaces).toBeUndefined()
			expect(exp.imageLibrary).toBeUndefined()
			// Connections deselected → only minimally-referenced connections are included
			expect(exp.instances).toEqual({})
		})

		test('the custom filename is honoured', async () => {
			const { app } = createController()
			const res = await get(app, `/int/api/export/custom?${validQuery}&filename=mine`)
			expect(res.headers['content-disposition']).toContain('filename="mine.companionconfig"')
		})
	})

	// ── Full export ─────────────────────────────────────────────────────────────

	describe('full export', () => {
		test('exports everything (config === null path)', async () => {
			const { app, instance, surfaces } = createController()
			const res = await get(app, '/int/api/export/full?format=json')

			expect(res.status).toBe(200)
			const exp = decodeExport(res.body, 'json')
			expect(exp).toMatchObject({ type: 'full', version: FILE_VERSION })
			expect(exp.pages).toBeDefined()
			expect(exp.surfaces).toBeDefined()
			// Full export always includes all connections (secrets included)
			expect(instance.exportAllConnections).toHaveBeenCalledWith(true)
			expect(surfaces.exportAll).toHaveBeenCalled()
		})

		test('uses the default export filename with a full_config suffix', async () => {
			const { app } = createController()
			const res = await get(app, '/int/api/export/full')
			expect(res.headers['content-disposition']).toContain(
				`filename="${DEFAULT_EXPORT_FILENAME}_full_config.companionconfig"`
			)
		})
	})

	// ── Log export ──────────────────────────────────────────────────────────────

	describe('log export', () => {
		afterEach(() => vi.restoreAllMocks())

		test('exports the log as csv with a header row', async () => {
			const { app } = createController()
			vi.spyOn(LogController, 'getAllLines').mockReturnValue([
				{ time: 0, source: 'moduleA', level: 'info', message: 'hello' },
				{ time: 1000, source: 'moduleB', level: 'warn', message: 'careful' },
			])

			const res = await get(app, '/int/api/export/log')

			expect(res.status).toBe(200)
			const text = res.body.toString('utf-8')
			expect(text).toContain('Date,Module,Type,Log')
			expect(text).toContain('moduleA')
			expect(text).toContain('hello')
			expect(text).toContain('careful')
			expect(res.headers['content-disposition']).toContain(`filename="${DEFAULT_EXPORT_FILENAME}_companion_log.csv"`)
		})
	})

	// ── Support bundle (zip) ────────────────────────────────────────────────────

	describe('support bundle zip', () => {
		let tmpRoot: string
		let configDir: string

		beforeEach(async () => {
			tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ie-support-'))
			configDir = path.join(tmpRoot, 'config')
			await fs.mkdir(configDir, { recursive: true })
		})
		afterEach(async () => {
			vi.restoreAllMocks()
			await fs.rm(tmpRoot, { recursive: true, force: true })
		})

		/** Fetch the support bundle and unzip it into a { filename: string } map. */
		async function fetchBundle(app: Express.Express): Promise<Record<string, string>> {
			const res = await supertest(app).get('/int/api/export/support').buffer(true).parse(binaryParser)
			expect(res.status).toBe(200)

			const unzipped = unzipSync(new Uint8Array(res.body))
			const out: Record<string, string> = {}
			for (const [name, bytes] of Object.entries(unzipped)) {
				out[name] = Buffer.from(bytes).toString('utf-8')
			}
			return { __res: res as any, ...out }
		}

		test('produces a valid zip attachment', async () => {
			await fs.writeFile(path.join(configDir, 'db.sqlite'), 'FAKE-DB')
			const { app } = createController(configDir)
			vi.spyOn(LogController, 'getAllLines').mockReturnValue([])

			const res = await supertest(app).get('/int/api/export/support').buffer(true).parse(binaryParser)
			expect(res.status).toBe(200)
			expect(res.headers['content-disposition']).toContain('.zip')
			// zip local-file-header magic "PK\x03\x04"
			expect(res.body[0]).toBe(0x50)
			expect(res.body[1]).toBe(0x4b)

			const unzipped = unzipSync(new Uint8Array(res.body))
			expect(Object.keys(unzipped)).toContain('db.sqlite')
		})

		test('includes config files, generated log.csv and user.json', async () => {
			await fs.writeFile(path.join(configDir, 'db.sqlite'), 'FAKE-DB')
			await fs.mkdir(path.join(configDir, 'nested'), { recursive: true })
			await fs.writeFile(path.join(configDir, 'nested', 'inner.txt'), 'INNER')

			const { app } = createController(configDir)
			vi.spyOn(LogController, 'getAllLines').mockReturnValue([
				{ time: 0, source: 'src', level: 'info', message: 'boot' },
			])

			const files = await fetchBundle(app)

			expect(files['db.sqlite']).toBe('FAKE-DB')
			expect(files[path.join('nested', 'inner.txt')]).toBe('INNER')
			expect(files['log.csv']).toContain('"Date","Module","Type","Log"')
			expect(files['log.csv']).toContain('boot')

			const user = JSON.parse(files['user.json'])
			expect(user).toMatchObject({
				id: 'test-machine-id',
				app: { name: 'companion', version: '4.0.0', build: 'test-build-1' },
			})
		})

		test('excludes the cloud directory from the config', async () => {
			await fs.writeFile(path.join(configDir, 'db.sqlite'), 'DB')
			await fs.mkdir(path.join(configDir, 'cloud'), { recursive: true })
			await fs.writeFile(path.join(configDir, 'cloud', 'secret.txt'), 'SECRET')

			const { app } = createController(configDir)
			vi.spyOn(LogController, 'getAllLines').mockReturnValue([])

			const files = await fetchBundle(app)
			expect(files['db.sqlite']).toBe('DB')
			expect(Object.keys(files)).not.toContain(path.join('cloud', 'secret.txt'))
		})

		test('includes the logs directory when present', async () => {
			await fs.writeFile(path.join(configDir, 'db.sqlite'), 'DB')
			// logs live at `<configDir>/../logs`
			const logsDir = path.join(tmpRoot, 'logs')
			await fs.mkdir(logsDir, { recursive: true })
			await fs.writeFile(path.join(logsDir, 'companion.log'), 'LOGDATA')

			const { app } = createController(configDir)
			vi.spyOn(LogController, 'getAllLines').mockReturnValue([])

			const files = await fetchBundle(app)
			expect(files[path.join('logs', 'companion.log')]).toBe('LOGDATA')
		})

		test('omits the logs directory when it does not exist', async () => {
			await fs.writeFile(path.join(configDir, 'db.sqlite'), 'DB')
			const { app } = createController(configDir)
			vi.spyOn(LogController, 'getAllLines').mockReturnValue([])

			const files = await fetchBundle(app)
			const hasLogsEntry = Object.keys(files).some((f) => f.startsWith('logs' + path.sep) || f.startsWith('logs/'))
			expect(hasLogsEntry).toBe(false)
		})

		test('a missing config dir results in a 500', async () => {
			const { app } = createController(path.join(tmpRoot, 'no-such-config'))
			vi.spyOn(LogController, 'getAllLines').mockReturnValue([])

			const res = await supertest(app).get('/int/api/export/support').buffer(true).parse(binaryParser)
			expect(res.status).toBe(500)
		})
	})
})
