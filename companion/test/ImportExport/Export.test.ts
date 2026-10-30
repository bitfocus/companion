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
import { EXPORT_VERSION } from '@companion-app/shared/Model/Export/Latest.js'
import {
	EXPORT_NOTES_MAX_LENGTH,
	zodClientExportRequest,
	type ClientExportOutput,
	type ClientExportRequest,
	type ClientExportSelection,
	type ClientExportTarget,
} from '@companion-app/shared/Model/ImportExport.js'
import type { ControlsController } from '../../lib/Controls/Controller.js'
import type { ControlTrigger } from '../../lib/Controls/ControlTypes/Triggers/Trigger.js'
import type { DataUserConfig } from '../../lib/Data/UserConfig.js'
import type { GraphicsController } from '../../lib/Graphics/Controller.js'
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

	const TRIGGERS: ClientExportTarget = { type: 'triggers', includeSecrets: true }

	function makeRequest(target: ClientExportTarget, output: Partial<ClientExportOutput> = {}): ClientExportRequest {
		return { target, output: { format: 'json', filename: 'export', notes: '', ...output } }
	}

	/** Prepare an export as the UI does, then download it */
	function download(
		ctx: ReturnType<typeof createController>,
		target: ClientExportTarget,
		output: Partial<ClientExportOutput> = {}
	) {
		const token = ctx.controller.prepareDownload(makeRequest(target, output), '10.0.0.1')
		return get(ctx.app, `/int/api/export/download/${token}`)
	}

	// ── Download format handling (downloadBlob) ─────────────────────────────────

	describe('download format handling', () => {
		test('format=json-gz streams gzip that round-trips', async () => {
			const ctx = createController()
			const res = await download(ctx, TRIGGERS, { format: 'json-gz' })

			expect(res.status).toBe(200)
			expect(res.headers['content-type']).toBe('application/octet-stream')
			// gzip magic bytes
			expect(res.body[0]).toBe(0x1f)
			expect(res.body[1]).toBe(0x8b)

			const decoded = decodeExport(res.body, 'json-gz')
			expect(decoded).toMatchObject({ type: 'trigger_list', version: EXPORT_VERSION })
		})

		test('format=json returns a tab-indented buffer', async () => {
			const ctx = createController()
			const res = await download(ctx, TRIGGERS, { format: 'json' })

			expect(res.status).toBe(200)
			const text = res.body.toString('utf-8')
			// Pretty-printed with tabs, not gzipped
			expect(text).toContain('\n')
			expect(text).toContain('\t')
			expect(decodeExport(res.body, 'json')).toMatchObject({ type: 'trigger_list' })
		})

		test('format=yaml returns a yaml buffer', async () => {
			const ctx = createController()
			const res = await download(ctx, TRIGGERS, { format: 'yaml' })

			expect(res.status).toBe(200)
			const text = res.body.toString('utf-8')
			expect(text).toContain('type: trigger_list')
			expect(decodeExport(res.body, 'yaml')).toMatchObject({ type: 'trigger_list', version: EXPORT_VERSION })
		})

		test('sets an attachment content-disposition with ascii and utf-8 filenames', async () => {
			const ctx = createController()
			const res = await download(ctx, TRIGGERS, { filename: 'my-export' })

			expect(res.headers['content-disposition']).toContain('attachment;')
			expect(res.headers['content-disposition']).toContain('filename="my-export.companionconfig"')
			expect(res.headers['content-disposition']).toContain("filename*=UTF-8''my-export.companionconfig")
		})
	})

	// ── Filename generation ─────────────────────────────────────────────────────

	describe('filename generation', () => {
		test('a custom filename is used verbatim without an export-type suffix', async () => {
			const ctx = createController()
			const res = await download(ctx, TRIGGERS, { filename: 'custom-name' })

			expect(res.headers['content-disposition']).toContain('filename="custom-name.companionconfig"')
		})

		test('the default filename gets the export type appended', async () => {
			const ctx = createController()
			// filename matching the configured default → treated as "still using the default"
			const res = await download(ctx, TRIGGERS, { filename: DEFAULT_EXPORT_FILENAME })

			expect(res.headers['content-disposition']).toContain(
				`filename="${DEFAULT_EXPORT_FILENAME}_trigger_list.companionconfig"`
			)
		})

		test('an empty filename falls back to hostname_timestamp_type', async () => {
			const ctx = createController()
			const res = await download(ctx, TRIGGERS, { filename: '' })

			const disposition = res.headers['content-disposition']
			// hostname_<timestamp>_trigger_list.companionconfig
			expect(disposition).toMatch(new RegExp(`filename="${os.hostname()}_.*_trigger_list\\.companionconfig"`))
		})

		test('variables in the filename are parsed', async () => {
			const ctx = createController()
			ctx.variables.values.createVariablesAndExpressionParser.mockReturnValue({
				parseVariables: () => ({ text: 'parsed-value' }),
			} as any)

			const res = await download(ctx, TRIGGERS, { filename: '$(internal:foo)' })
			expect(res.headers['content-disposition']).toContain('filename="parsed-value.companionconfig"')
		})
	})

	// ── Prepared downloads ──────────────────────────────────────────────────────

	describe('prepared downloads', () => {
		test('a token can only be downloaded once', async () => {
			const { app, controller } = createController()
			const token = controller.prepareDownload(makeRequest(TRIGGERS), '10.0.0.1')

			expect((await get(app, `/int/api/export/download/${token}`)).status).toBe(200)
			expect((await get(app, `/int/api/export/download/${token}`)).status).toBe(404)
		})

		test('an unknown token is a 404', async () => {
			const { app } = createController()
			const res = await get(app, '/int/api/export/download/nope')
			expect(res.status).toBe(404)
		})

		test('a token expires if it is not downloaded', async () => {
			vi.useFakeTimers()
			try {
				const { app, controller } = createController()
				const token = controller.prepareDownload(makeRequest(TRIGGERS), '10.0.0.1')

				vi.advanceTimersByTime(60_000)
				vi.useRealTimers()

				expect((await get(app, `/int/api/export/download/${token}`)).status).toBe(404)
			} finally {
				vi.useRealTimers()
			}
		})

		test('preparing another download replaces the pending one from the same client', async () => {
			const { app, controller } = createController()
			const first = controller.prepareDownload(makeRequest(TRIGGERS), '10.0.0.1')
			const second = controller.prepareDownload(makeRequest(TRIGGERS), '10.0.0.1')

			expect((await get(app, `/int/api/export/download/${first}`)).status).toBe(404)
			expect((await get(app, `/int/api/export/download/${second}`)).status).toBe(200)
		})

		test('different clients each keep a pending download', async () => {
			const { app, controller } = createController()
			const first = controller.prepareDownload(makeRequest(TRIGGERS), '10.0.0.1')
			const second = controller.prepareDownload(makeRequest(TRIGGERS), '10.0.0.2')

			expect((await get(app, `/int/api/export/download/${first}`)).status).toBe(200)
			expect((await get(app, `/int/api/export/download/${second}`)).status).toBe(200)
		})

		test('overlong notes are rejected by the request schema', () => {
			const parsed = zodClientExportRequest.safeParse(
				makeRequest(TRIGGERS, { notes: 'a'.repeat(EXPORT_NOTES_MAX_LENGTH + 1) })
			)
			expect(parsed.success).toBe(false)
		})

		test('the notes are included, trimmed', async () => {
			const ctx = createController()
			const res = await download(ctx, TRIGGERS, { notes: '  Swapped camera pages\nAdded audio page  ' })

			expect(decodeExport(res.body, 'json').notes).toBe('Swapped camera pages\nAdded audio page')
		})

		test('blank notes are omitted', async () => {
			const ctx = createController()
			const res = await download(ctx, TRIGGERS, { notes: '  ' })

			expect(decodeExport(res.body, 'json')).not.toHaveProperty('notes')
		})
	})

	// ── Trigger list export ─────────────────────────────────────────────────────

	describe('trigger list export', () => {
		test('exports all triggers with the expected envelope', async () => {
			const ctx = createController()
			ctx.controls.getAllTriggers.mockReturnValue([makeTrigger('trig1', 'My Trigger')])

			const res = await download(ctx, TRIGGERS)
			const exp = decodeExport(res.body, 'json')

			expect(exp).toMatchObject({
				type: 'trigger_list',
				version: EXPORT_VERSION,
				companionBuild: 'test-build-1',
			})
			expect(exp.triggers.trig1).toMatchObject({ type: 'trigger', options: { name: 'My Trigger' } })
			expect(exp.instances).toEqual({})
			expect(exp.triggerCollections).toEqual([])
		})

		test('includeSecrets=true is forwarded to exportConnection', async () => {
			const ctx = createController()
			const trigger = makeTrigger('trig1', 'Trig')
			trigger.collectReferencedConnectionsAndVariables = (ids: Set<string>) => {
				ids.add('conn-1')
			}
			ctx.controls.getAllTriggers.mockReturnValue([trigger])

			await download(ctx, TRIGGERS)
			expect(ctx.instance.exportConnection).toHaveBeenCalledWith('conn-1', false, true, true)
		})

		test('includeSecrets=false is forwarded to exportConnection', async () => {
			const ctx = createController()
			const trigger = makeTrigger('trig1', 'Trig')
			trigger.collectReferencedConnectionsAndVariables = (ids: Set<string>) => {
				ids.add('conn-1')
			}
			ctx.controls.getAllTriggers.mockReturnValue([trigger])

			await download(ctx, { type: 'triggers', includeSecrets: false })
			expect(ctx.instance.exportConnection).toHaveBeenCalledWith('conn-1', false, true, false)
		})

		test('ignores the internal connection', async () => {
			const ctx = createController()
			const trigger = makeTrigger('trig1', 'Trig')
			trigger.collectReferencedConnectionsAndVariables = (ids: Set<string>) => {
				ids.add('internal')
			}
			ctx.controls.getAllTriggers.mockReturnValue([trigger])

			const res = await download(ctx, TRIGGERS)
			expect(ctx.instance.exportConnection).not.toHaveBeenCalled()
			expect(decodeExport(res.body, 'json').instances).toEqual({})
		})
	})

	// ── Single trigger export ───────────────────────────────────────────────────

	describe('single trigger export', () => {
		const SINGLE: ClientExportTarget = { type: 'trigger', triggerId: 'trig1', includeSecrets: true }

		test('exports a single trigger and derives the filename from its name', async () => {
			const ctx = createController()
			ctx.controls.getTrigger.mockReturnValue(makeTrigger('trig1', 'Cool Trigger'))

			const res = await download(ctx, SINGLE, { filename: DEFAULT_EXPORT_FILENAME })

			expect(res.status).toBe(200)
			const exp = decodeExport(res.body, 'json')
			expect(exp.type).toBe('trigger_list')
			expect(exp.triggers.trig1).toBeDefined()
			// Name is lowercased with all non-word chars stripped → "cooltrigger"
			expect(res.headers['content-disposition']).toContain('trigger_cooltrigger.companionconfig')
		})

		test('all non-word characters are stripped from the derived trigger filename', async () => {
			const ctx = createController()
			ctx.controls.getTrigger.mockReturnValue(makeTrigger('trig1', 'My Cool Trigger! (v2)'))

			const res = await download(ctx, SINGLE, { filename: DEFAULT_EXPORT_FILENAME })

			// Every \W removed, not just the first - lower-cased and concatenated
			expect(res.headers['content-disposition']).toContain('trigger_mycooltriggerv2.companionconfig')
		})

		test('a single trigger export never includes collections', async () => {
			const ctx = createController()
			ctx.controls.getTrigger.mockReturnValue(makeTrigger('trig1', 'Trig', 'collection-1'))

			const res = await download(ctx, SINGLE)
			expect(decodeExport(res.body, 'json').triggerCollections).toEqual([])
			// getTrigger path must not fetch trigger collections
			expect(ctx.controls.exportTriggerCollections).not.toHaveBeenCalled()
		})

		test('a missing trigger is refused when preparing', () => {
			const { controller, controls } = createController()
			controls.getTrigger.mockReturnValue(undefined)

			expect(() => controller.prepareDownload(makeRequest(SINGLE), '10.0.0.1')).toThrow('not found')
		})

		test('a trigger deleted before downloading is a 404', async () => {
			const { app, controller, controls } = createController()
			controls.getTrigger.mockReturnValue(makeTrigger('trig1', 'Trig'))
			const token = controller.prepareDownload(makeRequest(SINGLE), '10.0.0.1')

			controls.getTrigger.mockReturnValue(undefined)
			expect((await get(app, `/int/api/export/download/${token}`)).status).toBe(404)
		})
	})

	// ── Single page export ──────────────────────────────────────────────────────

	describe('single page export', () => {
		const PAGE: ClientExportTarget = { type: 'page', pageNumber: 1, includeSecrets: true }

		test('exports a page envelope', async () => {
			const ctx = createController()
			ctx.pageStore.getPageInfo.mockReturnValue({ id: 'page-uuid-1', name: 'Page One', controls: {} })

			const res = await download(ctx, PAGE, { notes: 'Line 1\nLine 2' })
			expect(res.status).toBe(200)

			const exp = decodeExport(res.body, 'json')
			expect(exp).toMatchObject({
				type: 'page',
				version: EXPORT_VERSION,
				companionBuild: 'test-build-1',
				notes: 'Line 1\nLine 2',
				oldPageNumber: 1,
			})
			expect(exp.page).toMatchObject({ id: 'page-uuid-1', name: 'Page One' })
			expect(exp.page.gridSize).toEqual(DEFAULT_GRID_SIZE)
			expect(ctx.pageStore.getPageInfo).toHaveBeenCalledWith(1, true)
		})

		test('a missing page is refused when preparing', () => {
			const { controller, pageStore } = createController()
			pageStore.getPageInfo.mockReturnValue(undefined)

			expect(() => controller.prepareDownload(makeRequest(PAGE), '10.0.0.1')).toThrow('not found')
		})

		test('a page removed before downloading results in a 500', async () => {
			const { app, controller, pageStore } = createController()
			pageStore.getPageInfo.mockReturnValue({ id: 'p1', name: 'P1', controls: {} })
			const token = controller.prepareDownload(makeRequest(PAGE), '10.0.0.1')

			pageStore.getPageInfo.mockReturnValue(undefined)
			expect((await get(app, `/int/api/export/download/${token}`)).status).toBe(500)
		})

		test('the default filename gets the page number appended', async () => {
			const ctx = createController()
			ctx.pageStore.getPageInfo.mockReturnValue({ id: 'p2', name: 'P2', controls: {} })

			const res = await download(ctx, { ...PAGE, pageNumber: 2 }, { filename: DEFAULT_EXPORT_FILENAME })
			expect(res.headers['content-disposition']).toContain(
				`filename="${DEFAULT_EXPORT_FILENAME}_page2.companionconfig"`
			)
		})
	})

	// ── Custom export ───────────────────────────────────────────────────────────

	describe('custom export', () => {
		const allSelected: ClientExportSelection = {
			buttons: true,
			connections: true,
			triggers: true,
			customVariables: true,
			expressionVariables: true,
			includeSecrets: true,
			imageLibrary: true,
			surfaces: { known: true, instances: true, remote: true },
		}

		test('a full selection produces a full export', async () => {
			const ctx = createController()
			const res = await download(ctx, { type: 'custom', selection: allSelected })

			expect(res.status).toBe(200)
			const exp = decodeExport(res.body, 'json')
			expect(exp).toMatchObject({ type: 'full', version: EXPORT_VERSION })
			expect(exp.pages).toBeDefined()
			expect(exp.triggers).toBeDefined()
			expect(exp.instances).toBeDefined()
		})

		test('deselecting sections omits them from the export', async () => {
			const ctx = createController()
			const res = await download(ctx, {
				type: 'custom',
				selection: {
					buttons: false,
					connections: false,
					triggers: false,
					customVariables: false,
					expressionVariables: false,
					includeSecrets: false,
					imageLibrary: false,
					surfaces: null,
				},
			})
			const exp = decodeExport(res.body, 'json')

			expect(exp.pages).toBeUndefined()
			expect(exp.triggers).toBeUndefined()
			expect(exp.custom_variables).toBeUndefined()
			expect(exp.surfaces).toBeUndefined()
			expect(exp.imageLibrary).toBeUndefined()
			// Connections deselected → only minimally-referenced connections are included
			expect(exp.instances).toEqual({})
		})

		test('the default filename gets custom_config appended', async () => {
			const ctx = createController()
			const res = await download(ctx, { type: 'custom', selection: allSelected }, { filename: DEFAULT_EXPORT_FILENAME })
			expect(res.headers['content-disposition']).toContain(
				`filename="${DEFAULT_EXPORT_FILENAME}_custom_config.companionconfig"`
			)
		})
	})

	// ── Full export ─────────────────────────────────────────────────────────────

	describe('full export', () => {
		test('exports everything (config === null path)', async () => {
			const { app, instance, surfaces } = createController()
			const res = await get(app, '/int/api/export/full?format=json')

			expect(res.status).toBe(200)
			const exp = decodeExport(res.body, 'json')
			expect(exp).toMatchObject({ type: 'full', version: EXPORT_VERSION })
			expect(exp.pages).toBeDefined()
			expect(exp.surfaces).toBeDefined()
			// Full export always includes all connections (secrets included)
			expect(instance.exportAllConnections).toHaveBeenCalledWith(true)
			expect(surfaces.exportAll).toHaveBeenCalled()
		})

		test('defaults to json-gz, also for an unrecognised format', async () => {
			const { app } = createController()
			for (const url of ['/int/api/export/full', '/int/api/export/full?format=bson']) {
				const res = await get(app, url)

				expect(res.status).toBe(200)
				// gzip magic bytes
				expect(res.body[0]).toBe(0x1f)
				expect(res.body[1]).toBe(0x8b)
			}
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

		// Zip entry names always use forward slashes (ZIP spec; fflate also normalises them on read),
		// regardless of the host path separator - so entry-name assertions below use '/', not path.join.

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
			expect(files['nested/inner.txt']).toBe('INNER')
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
			expect(Object.keys(files)).not.toContain('cloud/secret.txt')
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
			expect(files['logs/companion.log']).toBe('LOGDATA')
		})

		test('omits the logs directory when it does not exist', async () => {
			await fs.writeFile(path.join(configDir, 'db.sqlite'), 'DB')
			const { app } = createController(configDir)
			vi.spyOn(LogController, 'getAllLines').mockReturnValue([])

			const files = await fetchBundle(app)
			const hasLogsEntry = Object.keys(files).some((f) => f.startsWith('logs/'))
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
