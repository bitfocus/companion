/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 *
 */

const FILE_VERSION = 7

import os from 'os'
import { upgradeImport } from '../Data/Upgrade.js'
import { cloneDeep } from 'lodash-es'
import { getTimestamp, isFalsey } from '../Resources/Util.js'
import { CreateTriggerControlId, ParseControlId, validateActionSetId } from '@companion-app/shared/ControlId.js'
import archiver from 'archiver'
import path from 'path'
import fs from 'fs'
import yaml from 'yaml'
import zlib from 'node:zlib'
import { stringify as csvStringify } from 'csv-stringify/sync'
import { compareExportedInstances } from '@companion-app/shared/Import.js'
import LogController, { Logger } from '../Log/Controller.js'
import { ReferencesVisitors } from '../Resources/Visitors/ReferencesVisitors.js'
import { nanoid } from 'nanoid'
import type express from 'express'
import type { ParsedQs } from 'qs'
import type {
	ExportControlv6,
	ExportFullv6,
	ExportInstancesv6,
	ExportPageContentv6,
	ExportPageModelv6,
	ExportTriggerContentv6,
	ExportTriggersListv6,
	SomeExportv6,
} from '@companion-app/shared/Model/ExportModel.js'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import type { AppInfo } from '../Registry.js'
import type { PageModel } from '@companion-app/shared/Model/PageModel.js'
import type {
	ClientExportSelection,
	ClientImportObject,
	ClientPageInfo,
	ClientResetSelection,
	ConnectionRemappings,
} from '@companion-app/shared/Model/ImportExport.js'
import type { ClientSocket, UIHandler } from '../UI/Handler.js'
import type { ControlTrigger } from '../Controls/ControlTypes/Triggers/Trigger.js'
import type { ExportFormat } from '@companion-app/shared/Model/ExportFormat.js'
import type { TriggerModel } from '@companion-app/shared/Model/TriggerModel.js'
import type { ActionSetsModel } from '@companion-app/shared/Model/ActionModel.js'
import type { NormalButtonModel, SomeButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { InstanceController } from '../Instance/Controller.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import type { VariablesController } from '../Variables/Controller.js'
import type { ControlsController } from '../Controls/Controller.js'
import type { PageController } from '../Page/Controller.js'
import type { SurfaceController } from '../Surface/Controller.js'
import type { GraphicsController } from '../Graphics/Controller.js'
import type { InternalController } from '../Internal/Controller.js'
import { compileUpdatePayload } from '../UI/UpdatePayload.js'
import { SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'

function parseDownloadFormat(raw: ParsedQs[0]): ExportFormat | undefined {
	if (raw === 'json-gz' || raw === 'json' || raw === 'yaml') return raw
	return undefined
}

/**
 * Replacer that splits "png64" values into multiple lines.
 *
 * These are base64 encoded PNGs and can get very long. A length of 60 characters is used to allow
 * for indentation in the YAML.
 *
 * @param key - The key of the value being processed.
 * @param value - The value to be processed.
 * @returns The modified value or the original value if the conditions are not met.
 */
function splitLongPng64Values(key: string, value: string): string {
	if (key === 'png64' && typeof value === 'string' && value.length > 60) {
		return btoa(atob(value)).replace(/(.{60})/g, '$1\n') + '\n'
	}
	return value
}

/**
 * Compute a Content-Disposition header specifying an attachment with the
 * given filename.
 */
function attachmentWithFilename(filename: string): string {
	function quotedAscii(s: string): string {
		// Boil away combining characters and non-ASCII code points and escape
		// quotes.  Modern browsers don't use this, so don't bother going all-out.
		// Don't percent-encode anything, because browsers don't agree on whether
		// quoted filenames should be percent-decoded (Firefox and Chrome yes,
		// Safari no).
		return (
			'"' +
			[...s.normalize('NFKD')]
				.filter((c) => '\x20' <= c && c <= '\x7e')
				.map((c) => (c === '"' || c === '\\' ? '\\' : '') + c)
				.join('') +
			'"'
		)
	}

	// The filename parameter is used primarily by legacy browsers.  Strangely, it
	// must be present for at least some versions of Safari to use the modern
	// filename* parameter.
	const quotedFallbackAsciiFilename = quotedAscii(filename)
	const modernUnicodeFilename = encodeURIComponent(filename)
	return `attachment; filename=${quotedFallbackAsciiFilename}; filename*=UTF-8''${modernUnicodeFilename}`
}

function downloadBlob(
	logger: Logger,
	res: express.Response,
	next: express.NextFunction,
	data: SomeExportv6,
	filename: string,
	format: ExportFormat | undefined
): void {
	if (!format || format === 'json-gz') {
		zlib.gzip(JSON.stringify(data), (err, result) => {
			if (err) {
				logger.warn(`Failed to gzip data, retrying uncompressed: ${err}`)
				downloadBlob(logger, res, next, data, filename, 'json')
			} else {
				res.status(200)
				res.set({
					'Content-Type': 'application/gzip',
					'Content-Disposition': attachmentWithFilename(filename),
				})
				res.end(result)
			}
		})
	} else if (format === 'json') {
		res.status(200)
		res.set({
			'Content-Type': 'application/json',
			'Content-Disposition': attachmentWithFilename(filename),
		})
		res.end(JSON.stringify(data, undefined, '\t'))
	} else if (format === 'yaml') {
		res.status(200)
		res.set({
			'Content-Type': 'application/yaml',
			'Content-Disposition': attachmentWithFilename(filename),
		})
		res.end(yaml.stringify(data, splitLongPng64Values))
	} else {
		next(new Error(`Unknown format: ${format}`))
	}
}

const find_smallest_grid_for_page = (pageInfo: ExportPageContentv6): UserConfigGridSize => {
	const gridSize: UserConfigGridSize = {
		minColumn: 0,
		maxColumn: 7,
		minRow: 0,
		maxRow: 3,
	}

	// Scan through the data in the export, to find the minimum possible grid size
	for (const [row0, rowObj] of Object.entries(pageInfo.controls || {})) {
		const row = Number(row0)
		let foundControl = false

		for (const column0 of Object.keys(rowObj)) {
			const column = Number(column0)

			if (!rowObj[column]) continue
			foundControl = true

			if (column < gridSize.minColumn) gridSize.minColumn = column
			if (column > gridSize.maxColumn) gridSize.maxColumn = column
		}

		if (foundControl) {
			if (row < gridSize.minRow) gridSize.minRow = row
			if (row > gridSize.maxRow) gridSize.maxRow = row
		}
	}

	return gridSize
}

export class ImportExportController {
	readonly #logger = LogController.createLogger('ImportExport/Controller')

	readonly #appInfo: AppInfo
	readonly #io: UIHandler
	readonly #controlsController: ControlsController
	readonly #graphicsController: GraphicsController
	readonly #instancesController: InstanceController
	readonly #internalModule: InternalController
	readonly #pagesController: PageController
	readonly #surfacesController: SurfaceController
	readonly #userConfigController: DataUserConfig
	readonly #variablesController: VariablesController

	/**
	 * If there is a current import task that clients should be aware of, this will be set
	 */
	#currentImportTask: 'reset' | 'import' | null = null

	constructor(
		appInfo: AppInfo,
		apiRouter: express.Router,
		io: UIHandler,
		controls: ControlsController,
		graphics: GraphicsController,
		instance: InstanceController,
		internalModule: InternalController,
		page: PageController,
		surfaces: SurfaceController,
		userconfig: DataUserConfig,
		variablesController: VariablesController
	) {
		this.#appInfo = appInfo
		this.#io = io
		this.#controlsController = controls
		this.#graphicsController = graphics
		this.#instancesController = instance
		this.#internalModule = internalModule
		this.#pagesController = page
		this.#surfacesController = surfaces
		this.#userConfigController = userconfig
		this.#variablesController = variablesController

		const generate_export_for_referenced_instances = (
			referencedConnectionIds: Set<string>,
			referencedConnectionLabels: Set<string>,
			minimalExport = false
		): ExportInstancesv6 => {
			const instancesExport: ExportInstancesv6 = {}

			referencedConnectionIds.delete('internal') // Ignore the internal module
			for (const connectionId of referencedConnectionIds) {
				instancesExport[connectionId] = this.#instancesController.exportInstance(connectionId, minimalExport)
			}

			referencedConnectionLabels.delete('internal') // Ignore the internal module
			for (const label of referencedConnectionLabels) {
				const connectionId = this.#instancesController.getIdForLabel(label)
				if (connectionId) {
					instancesExport[connectionId] = this.#instancesController.exportInstance(connectionId, minimalExport)
				}
			}

			return instancesExport
		}

		//Parse variables and generate filename based on export type
		const generateFilename = (filename: string, exportType: string, fileExt: string): string => {
			//If the user isn't using their default file name, don't append any extra info in file name since it was a manual choice
			const useDefault = filename == this.#userConfigController.getKey('default_export_filename')
			const parsedName = this.#variablesController.values.parseVariables(filename, null).text

			return parsedName && parsedName !== 'undefined'
				? `${parsedName}${exportType && useDefault ? '_' + exportType : ''}.${fileExt}`
				: `${os.hostname()}_${getTimestamp()}_${exportType}.${fileExt}`
		}

		const generate_export_for_triggers = (triggerControls: ControlTrigger[]): ExportTriggersListv6 => {
			const triggersExport: ExportTriggerContentv6 = {}
			const referencedConnectionIds = new Set<string>()
			const referencedConnectionLabels = new Set<string>()
			for (const control of triggerControls) {
				const parsedId = ParseControlId(control.controlId)
				if (parsedId?.type === 'trigger') {
					triggersExport[parsedId.trigger] = control.toJSON(false)

					control.collectReferencedConnections(referencedConnectionIds, referencedConnectionLabels)
				}
			}

			const instancesExport = generate_export_for_referenced_instances(
				referencedConnectionIds,
				referencedConnectionLabels
			)

			return {
				type: 'trigger_list',
				version: FILE_VERSION,
				triggers: triggersExport,
				instances: instancesExport,
			}
		}

		apiRouter.get('/export/triggers/all', (req, res, next) => {
			const triggerControls = this.#controlsController.getAllTriggers()
			const exp = generate_export_for_triggers(triggerControls)

			const filename = generateFilename(String(req.query.filename), 'trigger_list', 'companionconfig')

			downloadBlob(this.#logger, res, next, exp, filename, parseDownloadFormat(req.query.format))
		})

		apiRouter.get('/export/triggers/single/:id', (req, res, next) => {
			const control = this.#controlsController.getTrigger(req.params.id)
			if (control) {
				const exp = generate_export_for_triggers([control])

				const triggerName = control.options.name.toLowerCase().replace(/\W/, '')
				const filename = generateFilename(String(req.query.filename), `trigger_${triggerName}`, 'companionconfig')

				downloadBlob(this.#logger, res, next, exp, filename, parseDownloadFormat(req.query.format))
			} else {
				next()
			}
		})

		apiRouter.get('/export/page/:page', (req, res, next) => {
			const page = Number(req.params.page)
			if (isNaN(page)) {
				next()
			} else {
				const pageInfo = this.#pagesController.getPageInfo(page, true)
				if (!pageInfo) throw new Error(`Page "${page}" not found!`)

				const referencedConnectionIds = new Set<string>()
				const referencedConnectionLabels = new Set<string>()

				const pageExport = generatePageExportInfo(pageInfo, referencedConnectionIds, referencedConnectionLabels)

				const instancesExport = generate_export_for_referenced_instances(
					referencedConnectionIds,
					referencedConnectionLabels
				)

				// Export file protocol version
				const exp: ExportPageModelv6 = {
					version: FILE_VERSION,
					type: 'page',
					page: pageExport,
					instances: instancesExport,
					oldPageNumber: page,
				}

				const filename = generateFilename(String(req.query.filename), `page${page}`, 'companionconfig')

				downloadBlob(this.#logger, res, next, exp, filename, parseDownloadFormat(req.query.format))
			}
		})

		const generatePageExportInfo = (
			pageInfo: PageModel,
			referencedConnectionIds: Set<string>,
			referencedConnectionLabels: Set<string>
		): ExportPageContentv6 => {
			const pageExport: ExportPageContentv6 = {
				name: pageInfo.name,
				controls: {},
				gridSize: this.#userConfigController.getKey('gridSize'),
			}

			for (const [row, rowObj] of Object.entries(pageInfo.controls)) {
				for (const [column, controlId] of Object.entries(rowObj)) {
					const control = this.#controlsController.getControl(controlId)
					if (controlId && control && control.type !== 'trigger') {
						if (!pageExport.controls[Number(row)]) pageExport.controls[Number(row)] = {}
						pageExport.controls[Number(row)][Number(column)] = control.toJSON(false)

						control.collectReferencedConnections(referencedConnectionIds, referencedConnectionLabels)
					}
				}
			}

			return pageExport
		}

		const generateCustomExport = (config: ClientExportSelection | null): ExportFullv6 => {
			// Export file protocol version
			const exp: ExportFullv6 = {
				version: FILE_VERSION,
				type: 'full',
			}

			const rawControls = this.#controlsController.getAllControls()

			const referencedConnectionIds = new Set<string>()
			const referencedConnectionLabels = new Set<string>()

			if (!config || !isFalsey(config.buttons)) {
				exp.pages = {}

				const pageInfos = this.#pagesController.getAll()
				for (const [pageNumber, rawPageInfo] of Object.entries(pageInfos)) {
					exp.pages[Number(pageNumber)] = generatePageExportInfo(
						rawPageInfo,
						referencedConnectionIds,
						referencedConnectionLabels
					)
				}
			}

			if (!config || !isFalsey(config.triggers)) {
				const triggersExport: ExportTriggerContentv6 = {}
				for (const control of rawControls.values()) {
					if (control.type === 'trigger') {
						const parsedId = ParseControlId(control.controlId)
						if (parsedId?.type === 'trigger') {
							triggersExport[parsedId.trigger] = control.toJSON(false)

							control.collectReferencedConnections(referencedConnectionIds, referencedConnectionLabels)
						}
					}
				}
				exp.triggers = triggersExport
			}

			if (!config || !isFalsey(config.customVariables)) {
				exp.custom_variables = this.#variablesController.custom.getDefinitions()
			}

			if (!config || !isFalsey(config.connections)) {
				exp.instances = this.#instancesController.exportAll(false)
			} else {
				exp.instances = generate_export_for_referenced_instances(
					referencedConnectionIds,
					referencedConnectionLabels,
					true
				)
			}

			if (!config || !isFalsey(config.surfaces)) {
				exp.surfaces = this.#surfacesController.exportAll(false)
				exp.surfaceGroups = this.#surfacesController.exportAllGroups(false)
			}

			return exp
		}

		apiRouter.get('/export/custom', (req, res, next) => {
			// @ts-expect-error
			const exp = generateCustomExport(req.query)

			const filename = generateFilename(String(req.query.filename), '', 'companionconfig')

			downloadBlob(this.#logger, res, next, exp, filename, parseDownloadFormat(req.query.format))
		})

		apiRouter.get('/export/full', (req, res, next) => {
			const exp = generateCustomExport(null)

			const filename = generateFilename(
				String(this.#userConfigController.getKey('default_export_filename')),
				'full_config',
				'companionconfig'
			)

			downloadBlob(this.#logger, res, next, exp, filename, parseDownloadFormat(req.query.format))
		})

		apiRouter.get('/export/log', (_req, res, _next) => {
			const logs = LogController.getAllLines()

			const filename = generateFilename(
				String(this.#userConfigController.getKey('default_export_filename')),
				'companion_log',
				'csv'
			)

			res.status(200)
			res.set({
				'Content-Type': 'text/csv',
				'Content-Disposition': attachmentWithFilename(filename),
			})

			const csvOut = csvStringify([
				['Date', 'Module', 'Type', 'Log'],
				...logs.map((line) => [new Date(line.time).toISOString(), line.source, line.level, line.message]),
			])

			res.end(csvOut)
		})

		apiRouter.get('/export/support', (_req, res, _next) => {
			// Export support zip
			const archive = archiver('zip', { zlib: { level: 9 } })

			archive.on('error', (err) => {
				console.log(err)
			})

			//on stream closed we can end the request
			archive.on('end', () => {
				this.#logger.debug(`Support export wrote ${+archive.pointer()} bytes`)
			})

			//set the archive name
			const filename = generateFilename(
				String(this.#userConfigController.getKey('default_export_filename')),
				'companion-config',
				'zip'
			)
			res.attachment(filename)

			//this is the streaming magic
			archive.pipe(res)

			archive.glob(
				'*',
				{
					cwd: this.#appInfo.configDir,
					nodir: true,
					ignore: [
						'cloud', // Ignore companion-cloud credentials
					],
				},
				{}
			)

			// Add the logs if found
			const logsDir = path.join(this.#appInfo.configDir, '../logs')
			if (fs.existsSync(logsDir)) {
				archive.glob(
					'*',
					{
						cwd: logsDir,
						nodir: true,
					},
					{
						prefix: 'logs',
					}
				)
			}

			{
				const logs = LogController.getAllLines()

				let out = `"Date","Module","Type","Log"\r\n`
				for (const line of logs) {
					out += `${new Date(line.time).toISOString()},"${line.source}","${line.level}","${line.message}"\r\n`
				}

				archive.append(out, { name: 'log.csv' })
			}

			try {
				const payload = compileUpdatePayload(this.#appInfo)
				let out = JSON.stringify(payload)
				archive.append(out, { name: 'user.json' })
			} catch (e) {
				this.#logger.debug(`Support bundle append user: ${e}`)
			}

			archive.finalize()
		})
	}

	async #checkOrRunImportTask<T>(newTaskType: 'reset' | 'import', executeFn: () => Promise<T>): Promise<T> {
		if (this.#currentImportTask) throw new Error('Another operation is in progress')

		this.#currentImportTask = newTaskType
		this.#io.emitToAll('load-save:task', this.#currentImportTask)

		try {
			return await executeFn()
		} finally {
			this.#currentImportTask = null
			this.#io.emitToAll('load-save:task', this.#currentImportTask)
		}
	}

	/**
	 * Setup a new socket client's events
	 */
	clientConnect(client: ClientSocket): void {
		if (this.#currentImportTask) {
			// Inform about in progress task
			client.emit('load-save:task', this.#currentImportTask)
		}

		let clientPendingImport: ClientPendingImport | null = null

		client.onPromise('loadsave:abort', () => {
			if (clientPendingImport) {
				// TODO - stop timer
				clientPendingImport = null
			}

			return true
		})
		client.onPromise('loadsave:prepare-import', async (dataStr0) => {
			let dataStr: string
			try {
				dataStr = await new Promise((resolve, reject) => {
					zlib.gunzip(dataStr0, (err, data) => {
						if (err) reject(err)
						else resolve(data?.toString() || dataStr)
					})
				})
			} catch (e) {
				// Ignore, it is probably not compressed
				dataStr = dataStr0.toString()
			}

			let rawObject
			try {
				// YAML parser will handle JSON too
				rawObject = yaml.parse(dataStr)
			} catch (e) {
				return ['File is corrupted or unknown format']
			}

			if (rawObject.version > FILE_VERSION) {
				return ['File was saved with a newer unsupported version of Companion']
			}

			if (rawObject.type !== 'full' && rawObject.type !== 'page' && rawObject.type !== 'trigger_list') {
				return ['Unknown import type']
			}

			let object = upgradeImport(rawObject)

			// fix any db instances missing the upgradeIndex property
			if (object.instances) {
				for (const inst of Object.values(object.instances)) {
					if (inst) {
						inst.lastUpgradeIndex = inst.lastUpgradeIndex ?? -1
					}
				}
			}

			if (object.type === 'trigger_list') {
				object = {
					type: 'full',
					version: FILE_VERSION,
					triggers: object.triggers,
					instances: object.instances,
				} satisfies ExportFullv6
			}

			// Store the object on the client
			clientPendingImport = {
				object,
				timeout: null, // TODO
			}

			// Build a minimal object to send back to the client
			const clientObject: ClientImportObject = {
				type: object.type,
				instances: {},
				controls: 'pages' in object,
				customVariables: 'custom_variables' in object,
				surfaces: 'surfaces' in object,
				triggers: 'triggers' in object,
			}

			for (const [instanceId, instance] of Object.entries(object.instances || {})) {
				if (!instance || instanceId === 'internal' || instanceId === 'bitfocus-companion') continue

				clientObject.instances[instanceId] = {
					instance_type: instance.instance_type,
					moduleVersionId: instance.moduleVersionId ?? null,
					label: instance.label,
					sortOrder: instance.sortOrder,
				}
			}

			function simplifyPageForClient(pageInfo: ExportPageContentv6): ClientPageInfo {
				return {
					name: pageInfo.name,
					gridSize: find_smallest_grid_for_page(pageInfo),
				}
			}

			if (object.type === 'page') {
				clientObject.page = simplifyPageForClient(object.page)
				clientObject.oldPageNumber = object.oldPageNumber || 1
			} else {
				if (object.pages) {
					clientObject.pages = Object.fromEntries(
						Object.entries(object.pages).map(([id, pageInfo]) => [id, simplifyPageForClient(pageInfo)])
					)
				}

				// Simplify triggers
				if (object.triggers) {
					clientObject.triggers = {}

					for (const [id, trigger] of Object.entries(object.triggers)) {
						clientObject.triggers[id] = {
							name: trigger.options.name,
						}
					}
				}
			}

			// rest is done from browser
			return [null, clientObject]
		})

		client.onPromise('loadsave:control-preview', async (location) => {
			const importObject = clientPendingImport?.object
			if (!importObject) return null

			let importPage
			if (importObject.type === 'page') {
				importPage = importObject.page
			} else if (importObject.type === 'full') {
				importPage = importObject.pages?.[location.pageNumber]
			}
			if (!importPage) return null

			const controlObj = importPage.controls?.[location.row]?.[location.column]
			if (!controlObj) return null

			const res = await this.#graphicsController.drawPreview({
				...controlObj.style,
				style: controlObj.type,
			})
			return !!res?.style ? (res?.asDataUrl ?? null) : null
		})

		client.onPromise('loadsave:reset', (config) => {
			if (!config) throw new Error('Missing reset config')

			return this.#checkOrRunImportTask('reset', async () => {
				return this.#reset(config)
			})
		})

		client.onPromise('loadsave:import-full', async (config) => {
			return this.#checkOrRunImportTask('import', async () => {
				const data = clientPendingImport?.object
				if (!data) throw new Error('No in-progress import object')

				if (data.type !== 'full') throw new Error('Invalid import object')

				// Destroy old stuff
				await this.#reset(undefined, !config || config.buttons)

				// import custom variables
				if (!config || config.customVariables) {
					this.#variablesController.custom.replaceDefinitions(data.custom_variables || {})
				}

				// Always Import instances
				const instanceIdMap = this.#importInstances(data.instances, {})

				if (data.pages && (!config || config.buttons)) {
					// Import pages
					for (const [pageNumber0, pageInfo] of Object.entries(data.pages)) {
						if (!pageInfo) continue

						const pageNumber = Number(pageNumber0)
						if (isNaN(pageNumber)) {
							this.#logger.warn(`Invalid page number: ${pageNumber0}`)
							continue
						}

						// Ensure the page exists
						const insertPageCount = pageNumber - this.#pagesController.getPageCount()
						if (insertPageCount > 0) {
							this.#pagesController.insertPages(
								this.#pagesController.getPageCount() + 1,
								new Array(insertPageCount).fill('Page')
							)
						}

						doPageImport(pageInfo, pageNumber, instanceIdMap)
					}
				}

				if (!config || config.surfaces) {
					this.#surfacesController.importSurfaces(data.surfaceGroups || {}, data.surfaces || {})
				}

				if (!config || config.triggers) {
					for (const [id, trigger] of Object.entries(data.triggers || {})) {
						const controlId = CreateTriggerControlId(id)
						const fixedControlObj = this.#fixupTriggerControl(trigger, instanceIdMap)
						this.#controlsController.importTrigger(controlId, fixedControlObj)
					}
				}

				// trigger startup triggers to run
				setImmediate(() => {
					this.#controlsController.triggers.emit('startup')
				})
			})
		})

		const doPageImport = (
			pageInfo: ExportPageContentv6,
			topage: number,
			instanceIdMap: InstanceAppliedRemappings
		): void => {
			{
				// Ensure the configured grid size is large enough for the import
				const requiredSize = pageInfo.gridSize || find_smallest_grid_for_page(pageInfo)
				const currentSize = this.#userConfigController.getKey('gridSize')
				const updatedSize: Partial<UserConfigGridSize> = {}
				if (currentSize.minColumn > requiredSize.minColumn) updatedSize.minColumn = Number(requiredSize.minColumn)
				if (currentSize.maxColumn < requiredSize.maxColumn) updatedSize.maxColumn = Number(requiredSize.maxColumn)
				if (currentSize.minRow > requiredSize.minRow) updatedSize.minRow = Number(requiredSize.minRow)
				if (currentSize.maxRow < requiredSize.maxRow) updatedSize.maxRow = Number(requiredSize.maxRow)

				if (Object.keys(updatedSize).length > 0) {
					this.#userConfigController.setKey('gridSize', {
						...currentSize,
						...updatedSize,
					})
				}
			}

			// Import the new page
			this.#pagesController.setPageName(topage, pageInfo.name)

			// Import the controls
			for (const [row, rowObj] of Object.entries(pageInfo.controls)) {
				for (const [column, control] of Object.entries(rowObj)) {
					if (control) {
						// Import the control
						const fixedControlObj = this.#fixupControl(cloneDeep(control), instanceIdMap)

						const location: ControlLocation = {
							pageNumber: Number(topage),
							column: Number(column),
							row: Number(row),
						}
						this.#controlsController.importControl(location, fixedControlObj)
					}
				}
			}
		}

		client.onPromise('loadsave:import-page', async (topage, frompage, instanceRemapping) => {
			return this.#checkOrRunImportTask('import', async () => {
				const data = clientPendingImport?.object
				if (!data) throw new Error('No in-progress import object')

				if (topage === -1) {
					// Add a new page at the end
					const currentPageCount = this.#pagesController.getPageCount()
					topage = currentPageCount + 1
					this.#pagesController.insertPages(topage, ['Importing Page'])
				} else {
					const oldPageInfo = this.#pagesController.getPageInfo(topage, false)
					if (!oldPageInfo) throw new Error('Invalid target page')
				}

				let pageInfo

				if (data.type === 'full' && data.pages) {
					pageInfo = data.pages[frompage]

					// continue below
				} else if (data.type === 'page') {
					pageInfo = data.page

					frompage = data.oldPageNumber || 1

					// continue below
				} else {
					throw new Error('Cannot import page ')
				}

				if (!pageInfo) throw new Error(`No matching page to import`)

				// Setup the new instances
				const instanceIdMap = this.#importInstances(data.instances, instanceRemapping)

				// Cleanup the old page
				const discardedControlIds = this.#pagesController.resetPage(topage)
				for (const controlId of discardedControlIds) {
					this.#controlsController.deleteControl(controlId)
				}
				this.#graphicsController.clearAllForPage(topage)

				doPageImport(pageInfo, topage, instanceIdMap)

				// Report the used remap to the ui, for future imports
				const instanceRemap2: ConnectionRemappings = {}
				for (const [id, obj] of Object.entries(instanceIdMap)) {
					instanceRemap2[id] = obj.id
				}

				return instanceRemap2
			})
		})

		client.onPromise('loadsave:import-triggers', async (idsToImport0, instanceRemapping, replaceExisting) => {
			return this.#checkOrRunImportTask('import', async () => {
				const data = clientPendingImport?.object
				if (!data) throw new Error('No in-progress import object')

				if (data.type === 'page' || !data.triggers) throw new Error('No triggers in import')

				// Remove existing triggers
				if (replaceExisting) {
					const controls = this.#controlsController.getAllControls()
					for (const [controlId, control] of controls.entries()) {
						if (control.type === 'trigger') {
							this.#controlsController.deleteControl(controlId)
						}
					}
				}

				// Setup the new instances
				const instanceIdMap = this.#importInstances(data.instances, instanceRemapping)

				const idsToImport = new Set(idsToImport0)
				for (const id of idsToImport) {
					const trigger = data.triggers[id]

					let controlId = CreateTriggerControlId(id)
					// If trigger already exists, generate a new id
					if (this.#controlsController.getControl(controlId)) controlId = CreateTriggerControlId(nanoid())

					const fixedControlObj = this.#fixupTriggerControl(trigger, instanceIdMap)
					this.#controlsController.importTrigger(controlId, fixedControlObj)
				}

				// Report the used remap to the ui, for future imports
				const instanceRemap2: ConnectionRemappings = {}
				for (const [id, obj] of Object.entries(instanceIdMap)) {
					instanceRemap2[id] = obj.id
				}

				return instanceRemap2
			})
		})
	}

	async #reset(config: ClientResetSelection | undefined, skipNavButtons = false): Promise<'ok'> {
		const controls = this.#controlsController.getAllControls()

		if (!config || config.buttons) {
			for (const [controlId, control] of controls.entries()) {
				if (control.type !== 'trigger') {
					this.#controlsController.deleteControl(controlId)
				}
			}

			// Reset page 1
			this.#pagesController.resetPage(1) // Note: controls were already deleted above
			if (!skipNavButtons) {
				this.#pagesController.createPageDefaultNavButtons(1)
			}
			this.#graphicsController.clearAllForPage(1)

			// Delete other pages
			const pageCount = this.#pagesController.getPageCount()
			for (let pageNumber = pageCount; pageNumber >= 2; pageNumber--) {
				this.#pagesController.deletePage(pageNumber) // Note: controls were already deleted above
			}

			// reset the size
			this.#userConfigController.resetKey('gridSize')
		}

		if (!config || config.connections) {
			await this.#instancesController.deleteAllInstances()
		}

		if (!config || config.surfaces) {
			await this.#surfacesController.reset()
		}

		if (!config || config.triggers) {
			for (const [controlId, control] of controls.entries()) {
				if (control.type === 'trigger') {
					this.#controlsController.deleteControl(controlId)
				}
			}
		}

		if (!config || config.customVariables) {
			this.#variablesController.custom.reset()
		}

		if (!config || config.userconfig) {
			this.#userConfigController.reset()
		}

		return 'ok'
	}

	#importInstances(
		instances: ExportInstancesv6 | undefined,
		instanceRemapping: ConnectionRemappings
	): InstanceAppliedRemappings {
		const instanceIdMap: InstanceAppliedRemappings = {}

		if (instances) {
			const instanceEntries = Object.entries(instances)
				.filter((ent) => !!ent[1])
				.sort(compareExportedInstances)

			for (const [oldId, obj] of instanceEntries) {
				if (!obj) continue

				const remapId = instanceRemapping[oldId]
				const remapConfig = remapId ? this.#instancesController.getInstanceConfig(remapId) : undefined
				if (remapId === '_ignore') {
					// Ignore
					instanceIdMap[oldId] = { id: '_ignore', label: 'Ignore' }
				} else if (remapId && remapConfig?.label) {
					// Reuse an existing instance
					instanceIdMap[oldId] = {
						id: remapId,
						label: remapConfig.label,
						lastUpgradeIndex: obj.lastUpgradeIndex,
						oldLabel: obj.label,
					}
				} else {
					// Create a new instance
					const [newId, newConfig] = this.#instancesController.addInstanceWithLabel(
						{ type: obj.instance_type },
						obj.label,
						obj.moduleVersionId ?? null,
						obj.updatePolicy,
						true
					)
					if (newId && newConfig) {
						this.#instancesController.setInstanceLabelAndConfig(newId, null, 'config' in obj ? obj.config : null)

						if (!('enabled' in obj) || obj.enabled !== false) {
							this.#instancesController.enableDisableInstance(newId, true)
						}

						instanceIdMap[oldId] = {
							id: newId,
							label: newConfig.label,
							lastUpgradeIndex: obj.lastUpgradeIndex,
							oldLabel: obj.label,
						}
					}
				}
			}
		}

		// Force the internal module mapping
		instanceIdMap['internal'] = { id: 'internal', label: 'internal' }
		instanceIdMap['bitfocus-companion'] = { id: 'internal', label: 'internal' }

		return instanceIdMap
	}

	#fixupTriggerControl(control: ExportTriggerContentv6, instanceIdMap: InstanceAppliedRemappings): TriggerModel {
		// Future: this does not feel durable

		const connectionLabelRemap: Record<string, string> = {}
		const connectionIdRemap: Record<string, string> = {}
		for (const [oldId, info] of Object.entries(instanceIdMap)) {
			if (info.oldLabel && info.label !== info.oldLabel) {
				connectionLabelRemap[info.oldLabel] = info.label
			}
			if (info.id && info.id !== oldId) {
				connectionIdRemap[oldId] = info.id
			}
		}

		const result: TriggerModel = {
			type: 'trigger',
			options: cloneDeep(control.options),
			actions: [],
			condition: [],
			events: control.events,
		}

		if (control.condition) {
			result.condition = fixupEntitiesRecursive(instanceIdMap, cloneDeep(control.condition))
		}

		if (control.actions) {
			result.actions = fixupEntitiesRecursive(instanceIdMap, cloneDeep(control.actions))
		}

		ReferencesVisitors.fixupControlReferences(
			this.#internalModule,
			{
				connectionLabels: connectionLabelRemap,
				connectionIds: connectionIdRemap,
			},
			undefined,
			result.condition.concat(result.actions),
			[],
			result.events || [],
			false
		)

		return result
	}

	#fixupControl(control: ExportControlv6, instanceIdMap: InstanceAppliedRemappings): SomeButtonModel {
		// Future: this does not feel durable

		if (control.type === 'pagenum' || control.type === 'pageup' || control.type === 'pagedown') {
			return {
				type: control.type,
			}
		}

		const connectionLabelRemap: Record<string, string> = {}
		const connectionIdRemap: Record<string, string> = {}
		for (const [oldId, info] of Object.entries(instanceIdMap)) {
			if (info.oldLabel && info.label !== info.oldLabel) {
				connectionLabelRemap[info.oldLabel] = info.label
			}
			if (info.id && info.id !== oldId) {
				connectionIdRemap[oldId] = info.id
			}
		}

		const result: NormalButtonModel = {
			type: 'button',
			options: cloneDeep(control.options),
			style: cloneDeep(control.style),
			feedbacks: [],
			steps: {},
			localVariables: {}, // TODO-localvariables
		}

		if (control.feedbacks) {
			result.feedbacks = fixupEntitiesRecursive(instanceIdMap, cloneDeep(control.feedbacks))
		}

		const allEntities: SomeEntityModel[] = [...result.feedbacks]
		if (control.steps) {
			for (const [stepId, step] of Object.entries<any>(control.steps)) {
				const newStepSets: ActionSetsModel = {
					down: [],
					up: [],
					rotate_left: undefined,
					rotate_right: undefined,
				}
				result.steps[stepId] = {
					action_sets: newStepSets,
					options: cloneDeep(step.options),
				}

				for (const [setId, action_set] of Object.entries<any>(step.action_sets)) {
					const setIdSafe = validateActionSetId(setId as any)
					if (setIdSafe === undefined) {
						this.#logger.warn(`Invalid set id: ${setId}`)
						continue
					}

					const newActions = fixupEntitiesRecursive(instanceIdMap, cloneDeep(action_set) as any)

					newStepSets[setIdSafe] = newActions
					allEntities.push(...newActions)
				}
			}
		}

		ReferencesVisitors.fixupControlReferences(
			this.#internalModule,
			{
				connectionLabels: connectionLabelRemap,
				connectionIds: connectionIdRemap,
			},
			result.style,
			allEntities,
			[],
			[],
			false
		)

		return result
	}
}

type InstanceAppliedRemappings = Record<
	string,
	{ id: string; label: string; lastUpgradeIndex?: number; oldLabel?: string }
>

type ClientPendingImport = {
	object: ExportFullv6 | ExportPageModelv6
	timeout: null
}

function fixupEntitiesRecursive(
	instanceIdMap: InstanceAppliedRemappings,
	entities: SomeEntityModel[]
): SomeEntityModel[] {
	const newEntities: SomeEntityModel[] = []
	for (const entity of entities) {
		if (!entity) continue

		const instanceInfo = instanceIdMap[entity.connectionId]
		if (!instanceInfo) continue

		let newChildren: Record<string, SomeEntityModel[]> | undefined
		if (entity.connectionId === 'internal' && entity.children) {
			newChildren = {}
			for (const [group, childEntities] of Object.entries(entity.children)) {
				if (!childEntities) continue

				newChildren[group] = fixupEntitiesRecursive(instanceIdMap, childEntities)
			}
		}

		newEntities.push({
			...entity,
			connectionId: instanceInfo.id,
			upgradeIndex: instanceInfo.lastUpgradeIndex,
			children: newChildren,
		})
	}
	return newEntities
}
