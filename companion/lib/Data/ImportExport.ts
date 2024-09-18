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

const FILE_VERSION = 4

import os from 'os'
import { upgradeImport } from './Upgrade.js'
import { cloneDeep } from 'lodash-es'
import { getTimestamp, isFalsey } from '../Resources/Util.js'
import { CreateTriggerControlId, ParseControlId } from '@companion-app/shared/ControlId.js'
import { CoreBase } from '../Core/Base.js'
import archiver from 'archiver'
import path from 'path'
import fs from 'fs'
import zlib from 'node:zlib'
import { stringify as csvStringify } from 'csv-stringify/sync'
import { compareExportedInstances } from '@companion-app/shared/Import.js'
import LogController, { Logger } from '../Log/Controller.js'
import { ReferencesVisitors } from '../Util/Visitors/ReferencesVisitors.js'
import { nanoid } from 'nanoid'
import type express from 'express'
import type { ParsedQs } from 'qs'
import type {
	ExportControlv4,
	ExportFullv4,
	ExportInstancesv4,
	ExportPageContentv4,
	ExportPageModelv4,
	ExportTriggerContentv4,
	ExportTriggersListv4,
	SomeExportv4,
} from '@companion-app/shared/Model/ExportModel.js'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import type { Registry } from '../Registry.js'
import type { PageModel } from '@companion-app/shared/Model/PageModel.js'
import type {
	ClientExportSelection,
	ClientImportObject,
	ClientPageInfo,
	ClientResetSelection,
	InstanceRemappings,
} from '@companion-app/shared/Model/ImportExport.js'
import type { ClientSocket } from '../UI/Handler.js'
import type { ControlTrigger } from '../Controls/ControlTypes/Triggers/Trigger.js'
import type { TriggerModel } from '@companion-app/shared/Model/TriggerModel.js'
import type { FeedbackInstance } from '@companion-app/shared/Model/FeedbackModel.js'
import type { ActionInstance, ActionSetsModel } from '@companion-app/shared/Model/ActionModel.js'
import type { NormalButtonModel, SomeButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'

type DownloadFormat = 'json-gz' | 'json'
function parseDownloadFormat(raw: ParsedQs[0]): DownloadFormat | undefined {
	if (raw === 'json-gz' || raw === 'json') return raw
	return undefined
}

function downloadBlob(
	logger: Logger,
	res: express.Response,
	next: express.NextFunction,
	data: SomeExportv4,
	filename: string,
	format: DownloadFormat | undefined
): void {
	const dataStr = JSON.stringify(data, undefined, '\t')

	if (!format || format === 'json-gz') {
		zlib.gzip(dataStr, (err, result) => {
			if (err) {
				logger.warn(`Failed to gzip data, retrying uncompressed: ${err}`)
				downloadBlob(logger, res, next, data, filename, 'json')
			} else {
				res.status(200)
				res.set({
					'Content-Type': 'application/gzip',
					'Content-Disposition': `attachment; filename="${filename}"`,
				})
				res.end(result)
			}
		})
	} else if (format === 'json') {
		res.status(200)
		res.set({
			'Content-Type': 'application/json',
			'Content-Disposition': `attachment; filename="${filename}"`,
		})
		res.end(dataStr)
	} else {
		next(new Error(`Unknown format: ${format}`))
	}
}

const find_smallest_grid_for_page = (pageInfo: ExportPageContentv4): UserConfigGridSize => {
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

export class DataImportExport extends CoreBase {
	/**
	 * If there is a current import task that clients should be aware of, this will be set
	 */
	#currentImportTask: 'reset' | 'import' | null = null

	constructor(registry: Registry) {
		super(registry, 'Data/ImportExport')

		const generate_export_for_referenced_instances = (
			referencedConnectionIds: Set<string>,
			referencedConnectionLabels: Set<string>,
			minimalExport = false
		): ExportInstancesv4 => {
			const instancesExport: ExportInstancesv4 = {}

			referencedConnectionIds.delete('internal') // Ignore the internal module
			for (const connectionId of referencedConnectionIds) {
				instancesExport[connectionId] = this.instance.exportInstance(connectionId, minimalExport)
			}

			referencedConnectionLabels.delete('internal') // Ignore the internal module
			for (const label of referencedConnectionLabels) {
				const connectionId = this.instance.getIdForLabel(label)
				if (connectionId) {
					instancesExport[connectionId] = this.instance.exportInstance(connectionId, minimalExport)
				}
			}

			return instancesExport
		}

		const generate_export_for_triggers = (triggerControls: ControlTrigger[]): ExportTriggersListv4 => {
			const triggersExport: ExportTriggerContentv4 = {}
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

		this.registry.api_router.get('/export/triggers/all', (req, res, next) => {
			const triggerControls = this.controls.getAllTriggers()
			const exp = generate_export_for_triggers(triggerControls)

			const filename = encodeURI(`${os.hostname()}_trigger_list_${getTimestamp()}.companionconfig`)

			downloadBlob(this.logger, res, next, exp, filename, parseDownloadFormat(req.query.format))
		})

		this.registry.api_router.get('/export/triggers/single/:id', (req, res, next) => {
			const control = this.controls.getTrigger(req.params.id)
			if (control) {
				const exp = generate_export_for_triggers([control])

				const filename = encodeURI(
					`${os.hostname()}_trigger_${control.options.name
						.toLowerCase()
						.replace(/\W/, '')}_${getTimestamp()}.companionconfig`
				)

				downloadBlob(this.logger, res, next, exp, filename, parseDownloadFormat(req.query.format))
			} else {
				next()
			}
		})

		this.registry.api_router.get('/export/page/:page', (req, res, next) => {
			const page = Number(req.params.page)
			if (isNaN(page)) {
				next()
			} else {
				const pageInfo = this.page.getPageInfo(page, true)
				if (!pageInfo) throw new Error(`Page "${page}" not found!`)

				const referencedConnectionIds = new Set<string>()
				const referencedConnectionLabels = new Set<string>()

				const pageExport = generatePageExportInfo(pageInfo, referencedConnectionIds, referencedConnectionLabels)

				const instancesExport = generate_export_for_referenced_instances(
					referencedConnectionIds,
					referencedConnectionLabels
				)

				// Export file protocol version
				const exp: ExportPageModelv4 = {
					version: FILE_VERSION,
					type: 'page',
					page: pageExport,
					instances: instancesExport,
					oldPageNumber: page,
				}

				const filename = encodeURI(`${os.hostname()}_page${page}_${getTimestamp()}.companionconfig`)

				downloadBlob(this.logger, res, next, exp, filename, parseDownloadFormat(req.query.format))
			}
		})

		const generatePageExportInfo = (
			pageInfo: PageModel,
			referencedConnectionIds: Set<string>,
			referencedConnectionLabels: Set<string>
		): ExportPageContentv4 => {
			const pageExport: ExportPageContentv4 = {
				name: pageInfo.name,
				controls: {},
				gridSize: this.userconfig.getKey('gridSize'),
			}

			for (const [row, rowObj] of Object.entries(pageInfo.controls)) {
				for (const [column, controlId] of Object.entries(rowObj)) {
					const control = this.controls.getControl(controlId)
					if (controlId && control && control.type !== 'trigger') {
						if (!pageExport.controls[Number(row)]) pageExport.controls[Number(row)] = {}
						pageExport.controls[Number(row)][Number(column)] = control.toJSON(false)

						control.collectReferencedConnections(referencedConnectionIds, referencedConnectionLabels)
					}
				}
			}

			return pageExport
		}

		const generateCustomExport = (config: ClientExportSelection | null): ExportFullv4 => {
			// Export file protocol version
			const exp: ExportFullv4 = {
				version: FILE_VERSION,
				type: 'full',
			}

			const rawControls = this.controls.getAllControls()

			const referencedConnectionIds = new Set<string>()
			const referencedConnectionLabels = new Set<string>()

			if (!config || !isFalsey(config.buttons)) {
				exp.pages = {}

				const pageInfos = this.page.getAll()
				for (const [pageNumber, rawPageInfo] of Object.entries(pageInfos)) {
					exp.pages[Number(pageNumber)] = generatePageExportInfo(
						rawPageInfo,
						referencedConnectionIds,
						referencedConnectionLabels
					)
				}
			}

			if (!config || !isFalsey(config.triggers)) {
				const triggersExport: ExportTriggerContentv4 = {}
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
				exp.custom_variables = this.variablesController.custom.getDefinitions()
			}

			if (!config || !isFalsey(config.connections)) {
				exp.instances = this.instance.exportAll(false)
			} else {
				exp.instances = generate_export_for_referenced_instances(
					referencedConnectionIds,
					referencedConnectionLabels,
					true
				)
			}

			if (!config || !isFalsey(config.surfaces)) {
				exp.surfaces = this.surfaces.exportAll(false)
				exp.surfaceGroups = this.surfaces.exportAllGroups(false)
			}

			return exp
		}

		this.registry.api_router.get('/export/custom', (req, res, next) => {
			// @ts-expect-error
			const exp = generateCustomExport(req.query)

			const filename = encodeURI(`${os.hostname()}_custom-config_${getTimestamp()}.companionconfig`)

			downloadBlob(this.logger, res, next, exp, filename, parseDownloadFormat(req.query.format))
		})

		this.registry.api_router.get('/export/full', (req, res, next) => {
			const exp = generateCustomExport(null)

			const filename = encodeURI(`${os.hostname()}full-config_${getTimestamp()}.companionconfig`)

			downloadBlob(this.logger, res, next, exp, filename, parseDownloadFormat(req.query.format))
		})

		this.registry.api_router.get('/export/log', (_req, res, _next) => {
			const logs = LogController.getAllLines()

			const filename = encodeURI(`${os.hostname()}_companion_log_${getTimestamp()}.csv`)

			res.status(200)
			res.set({
				'Content-Type': 'text/csv',
				'Content-Disposition': `attachment; filename="${filename}"`,
			})

			const csvOut = csvStringify([
				['Date', 'Module', 'Type', 'Log'],
				...logs.map((line) => [new Date(line.time).toISOString(), line.source, line.level, line.message]),
			])

			res.end(csvOut)
		})

		this.registry.api_router.get('/export/support', (_req, res, _next) => {
			// Export support zip
			const archive = archiver('zip', { zlib: { level: 9 } })

			archive.on('error', (err) => {
				console.log(err)
			})

			//on stream closed we can end the request
			archive.on('end', () => {
				this.logger.debug(`Support export wrote ${+archive.pointer()} bytes`)
			})

			//set the archive name
			res.attachment(os.hostname() + '_companion-config_' + getTimestamp() + '.zip')

			//this is the streaming magic
			archive.pipe(res)

			archive.glob(
				'*',
				{
					cwd: this.registry.appInfo.configDir,
					nodir: true,
					ignore: [
						'cloud', // Ignore companion-cloud credentials
					],
				},
				{}
			)

			// Add the logs if found
			const logsDir = path.join(this.registry.appInfo.configDir, '../logs')
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
				const _db = this.db.getAll()
				const out = JSON.stringify(_db)
				archive.append(out, { name: 'db.ram' })
			} catch (e) {
				this.logger.debug(`Support bundle append db: ${e}`)
			}

			try {
				const payload = this.registry.ui.update.compilePayload()
				let out = JSON.stringify(payload)
				archive.append(out, { name: 'user.json' })
			} catch (e) {
				this.logger.debug(`Support bundle append user: ${e}`)
			}

			archive.finalize()
		})
	}

	async #checkOrRunImportTask<T>(newTaskType: 'reset' | 'import', executeFn: () => Promise<T>): Promise<T> {
		if (this.#currentImportTask) throw new Error('Another operation is in progress')

		this.#currentImportTask = newTaskType
		this.io.emit('load-save:task', this.#currentImportTask)

		try {
			return await executeFn()
		} finally {
			this.#currentImportTask = null
			this.io.emit('load-save:task', this.#currentImportTask)
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
		client.onPromise('loadsave:prepare-import', async (dataStr) => {
			try {
				dataStr = await new Promise((resolve, reject) => {
					zlib.gunzip(dataStr, (err, data) => {
						if (err) reject(err)
						else resolve(data || dataStr)
					})
				})
			} catch (e) {
				// Ignore, it is probably not compressed
			}

			let rawObject
			try {
				rawObject = JSON.parse(dataStr.toString())
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
				} satisfies ExportFullv4
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
					instance_type: this.instance.modules.verifyInstanceTypeIsCurrent(instance.instance_type),
					label: instance.label,
					sortOrder: instance.sortOrder,
				}
			}

			function simplifyPageForClient(pageInfo: ExportPageContentv4): ClientPageInfo {
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

			const res = await this.graphics.drawPreview({
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
					this.variablesController.custom.replaceDefinitions(data.custom_variables || {})
				}

				// Always Import instances
				const instanceIdMap = this.#importInstances(data.instances, {})

				if (data.pages && (!config || config.buttons)) {
					// Import pages
					for (const [pageNumber, pageInfo] of Object.entries(data.pages)) {
						doPageImport(pageInfo, Number(pageNumber), instanceIdMap)
					}
				}

				if (!config || config.surfaces) {
					this.surfaces.importSurfaces(data.surfaceGroups || {}, data.surfaces || {})
				}

				if (!config || config.triggers) {
					for (const [id, trigger] of Object.entries(data.triggers || {})) {
						const controlId = CreateTriggerControlId(id)
						const fixedControlObj = this.#fixupTriggerControl(trigger, instanceIdMap)
						this.controls.importTrigger(controlId, fixedControlObj)
					}
				}

				// trigger startup triggers to run
				setImmediate(() => {
					this.controls.triggers.emit('startup')
				})
			})
		})

		const doPageImport = (
			pageInfo: ExportPageContentv4,
			topage: number,
			instanceIdMap: InstanceAppliedRemappings
		): void => {
			// Cleanup the old page
			const discardedControlIds = this.page.resetPage(topage)
			for (const controlId of discardedControlIds) {
				this.controls.deleteControl(controlId)
			}

			if (pageInfo) {
				{
					// Ensure the configured grid size is large enough for the import
					const requiredSize = pageInfo.gridSize || find_smallest_grid_for_page(pageInfo)
					const currentSize = this.userconfig.getKey('gridSize')
					const updatedSize: Partial<UserConfigGridSize> = {}
					if (currentSize.minColumn > requiredSize.minColumn) updatedSize.minColumn = Number(requiredSize.minColumn)
					if (currentSize.maxColumn < requiredSize.maxColumn) updatedSize.maxColumn = Number(requiredSize.maxColumn)
					if (currentSize.minRow > requiredSize.minRow) updatedSize.minRow = Number(requiredSize.minRow)
					if (currentSize.maxRow < requiredSize.maxRow) updatedSize.maxRow = Number(requiredSize.maxRow)

					if (Object.keys(updatedSize).length > 0) {
						this.userconfig.setKey('gridSize', {
							...currentSize,
							...updatedSize,
						})
					}
				}

				// Import the new page
				this.page.setPageName(topage, pageInfo.name)

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
							this.controls.importControl(location, fixedControlObj)
						}
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
					const currentPageCount = this.page.getPageCount()
					topage = currentPageCount + 1
					this.page.insertPages(topage, ['Importing Page'])
				} else {
					const oldPageInfo = this.page.getPageInfo(topage, false)
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

				doPageImport(pageInfo, topage, instanceIdMap)

				// Report the used remap to the ui, for future imports
				const instanceRemap2: InstanceRemappings = {}
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
					const controls = this.controls.getAllControls()
					for (const [controlId, control] of controls.entries()) {
						if (control.type === 'trigger') {
							this.controls.deleteControl(controlId)
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
					if (this.controls.getControl(controlId)) controlId = CreateTriggerControlId(nanoid())

					const fixedControlObj = this.#fixupTriggerControl(trigger, instanceIdMap)
					this.controls.importTrigger(controlId, fixedControlObj)
				}

				// Report the used remap to the ui, for future imports
				const instanceRemap2: InstanceRemappings = {}
				for (const [id, obj] of Object.entries(instanceIdMap)) {
					instanceRemap2[id] = obj.id
				}

				return instanceRemap2
			})
		})
	}

	async #reset(config: ClientResetSelection | undefined, skipNavButtons = false): Promise<'ok'> {
		const controls = this.controls.getAllControls()

		if (!config || config.buttons) {
			for (const [controlId, control] of controls.entries()) {
				if (control.type !== 'trigger') {
					this.controls.deleteControl(controlId)
				}
			}

			// Reset page 1
			this.page.resetPage(1) // Note: controls were already deleted above
			if (!skipNavButtons) {
				this.page.createPageDefaultNavButtons(1)
			}

			// Delete other pages
			const pageCount = this.page.getPageCount()
			for (let pageNumber = pageCount; pageNumber >= 2; pageNumber--) {
				this.page.deletePage(pageNumber) // Note: controls were already deleted above
			}

			// reset the size
			this.userconfig.resetKey('gridSize')
		}

		if (!config || config.connections) {
			await this.instance.deleteAllInstances()
		}

		if (!config || config.surfaces) {
			await this.surfaces.reset()
		}

		if (!config || config.triggers) {
			for (const [controlId, control] of controls.entries()) {
				if (control.type === 'trigger') {
					this.controls.deleteControl(controlId)
				}
			}
		}

		if (!config || config.customVariables) {
			this.variablesController.custom.reset()
		}

		if (!config || config.userconfig) {
			this.userconfig.reset()
		}

		return 'ok'
	}

	#importInstances(
		instances: ExportInstancesv4 | undefined,
		instanceRemapping: InstanceRemappings
	): InstanceAppliedRemappings {
		const instanceIdMap: InstanceAppliedRemappings = {}

		if (instances) {
			const instanceEntries = Object.entries(instances)
				.filter((ent) => !!ent[1])
				.sort(compareExportedInstances)

			for (const [oldId, obj] of instanceEntries) {
				if (!obj) continue

				const remapId = instanceRemapping[oldId]
				const remapConfig = remapId ? this.instance.getInstanceConfig(remapId) : undefined
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
					const instance_type = this.instance.modules.verifyInstanceTypeIsCurrent(obj.instance_type)
					const [newId, newConfig] = this.instance.addInstanceWithLabel({ type: instance_type }, obj.label, true)
					console.log('created', instance_type, newId)
					if (newId && newConfig) {
						this.instance.setInstanceLabelAndConfig(newId, null, 'config' in obj ? obj.config : null)

						if (!('enabled' in obj) || obj.enabled !== false) {
							this.instance.enableDisableInstance(newId, true)
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

	#fixupTriggerControl(control: ExportTriggerContentv4, instanceIdMap: InstanceAppliedRemappings): TriggerModel {
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
			action_sets: {},
			condition: [],
			events: control.events,
		}

		if (control.condition) {
			const newFeedbacks: FeedbackInstance[] = []
			for (const feedback of control.condition) {
				const instanceInfo = instanceIdMap[feedback?.instance_id]
				if (feedback && instanceInfo) {
					newFeedbacks.push({
						...cloneDeep(feedback),
						instance_id: instanceInfo.id,
						upgradeIndex: instanceInfo.lastUpgradeIndex,
					})
				}
			}
			result.condition = newFeedbacks
		}

		const allActions: ActionInstance[] = []
		if (control.action_sets) {
			for (const [setId, action_set] of Object.entries(control.action_sets)) {
				const newActions: ActionInstance[] = []
				for (const action of action_set as any) {
					const instanceInfo = instanceIdMap[action?.instance]
					if (action && instanceInfo) {
						newActions.push({
							...cloneDeep(action),
							instance: instanceInfo.id,
							upgradeIndex: instanceInfo.lastUpgradeIndex,
						})
					}
				}
				result.action_sets[setId] = newActions
				allActions.push(...newActions)
			}
		}

		ReferencesVisitors.fixupControlReferences(
			this.internalModule,
			{
				connectionLabels: connectionLabelRemap,
				connectionIds: connectionIdRemap,
			},
			undefined,
			allActions,
			result.condition || [],
			[],
			result.events || [],
			false
		)

		return result
	}

	#fixupControl(control: ExportControlv4, instanceIdMap: InstanceAppliedRemappings): SomeButtonModel {
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
		}

		if (control.feedbacks) {
			const newFeedbacks: FeedbackInstance[] = []
			for (const feedback of control.feedbacks) {
				const instanceInfo = instanceIdMap[feedback?.instance_id]
				if (feedback && instanceInfo) {
					newFeedbacks.push({
						...cloneDeep(feedback),
						instance_id: instanceInfo.id,
						upgradeIndex: instanceInfo.lastUpgradeIndex,
					})
				}
			}
			result.feedbacks = newFeedbacks
		}

		const allActions: ActionInstance[] = []
		if (control.steps) {
			for (const [stepId, step] of Object.entries<any>(control.steps)) {
				const newStepSets: ActionSetsModel = {}
				result.steps[stepId] = {
					action_sets: newStepSets,
					options: cloneDeep(step.options),
				}

				for (const [setId, action_set] of Object.entries<any>(step.action_sets)) {
					const newActions: ActionInstance[] = []
					for (const action of action_set) {
						const instanceInfo = instanceIdMap[action?.instance]
						if (action && instanceInfo) {
							newActions.push({
								...cloneDeep(action),
								instance: instanceInfo.id,
								upgradeIndex: instanceInfo.lastUpgradeIndex,
							})
						}
					}
					newStepSets[setId] = newActions
					allActions.push(...newActions)
				}
			}
		}

		ReferencesVisitors.fixupControlReferences(
			this.internalModule,
			{
				connectionLabels: connectionLabelRemap,
				connectionIds: connectionIdRemap,
			},
			result.style,
			allActions,
			result.feedbacks || [],
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
	object: ExportFullv4 | ExportPageModelv4
	timeout: null
}
