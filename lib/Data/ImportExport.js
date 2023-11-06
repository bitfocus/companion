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
import { upgradeImport } from '../Data/Upgrade.js'
import { cloneDeep } from 'lodash-es'
import { getTimestamp, isFalsey } from '../Resources/Util.js'
import { CreateTriggerControlId, ParseControlId } from '../Shared/ControlId.js'
import CoreBase from '../Core/Base.js'
import archiver from 'archiver'
import { VisitorReferencesUpdater } from '../Util/Visitors/ReferencesUpdater.js'
import path from 'path'
import fs from 'fs'
import zlib from 'node:zlib'
import { stringify as csvStringify } from 'csv-stringify/sync'
import { visitEventOptions } from '../Resources/EventDefinitions.js'

/**
 * Default buttons on fresh pages
 */
const default_nav_buttons_definitions = [
	{
		type: 'pageup',
		location: {
			column: 0,
			row: 0,
		},
	},
	{
		type: 'pagenum',
		location: {
			column: 0,
			row: 1,
		},
	},
	{
		type: 'pagedown',
		location: {
			column: 0,
			row: 2,
		},
	},
]

/**
 * @param {import('winston').Logger} logger
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 * @param {import("./Model/ExportModel.js").SomeExportv4} data
 * @param {string} filename
 * @param {'json-gz' | 'json' | undefined} format
 * @returns {void}
 */
function downloadBlob(logger, res, next, data, filename, format) {
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

/**
 *
 * @param {import('./Model/ExportModel.js').ExportPageContentv4} pageInfo
 * @returns {import('./Model/ExportModel.js').ExportGridSize}
 */
const find_smallest_grid_for_page = (pageInfo) => {
	/** @type {import('./Model/ExportModel.js').ExportGridSize} */
	const gridSize = {
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

class DataImportExport extends CoreBase {
	/**
	 * If there is a current import task that clients should be aware of, this will be set
	 * @type {'reset' | 'import' | null}
	 * @access private
	 */
	#currentImportTask = null

	/**
	 * @param {import("../Registry.js").default} registry
	 */
	constructor(registry) {
		super(registry, 'import/export', 'Data/ImportExport')

		/**
		 *
		 * @param {Set<string>} referencedInstanceIds
		 * @param {Set<string>} referencedInstanceLabels
		 * @param {boolean} minimalExport
		 * @returns {import('./Model/ExportModel.js').ExportInstancesv4}
		 */
		const generate_export_for_referenced_instances = (
			referencedInstanceIds,
			referencedInstanceLabels,
			minimalExport = false
		) => {
			/** @type {import('./Model/ExportModel.js').ExportInstancesv4} */
			const instancesExport = {}

			referencedInstanceIds.delete('internal') // Ignore the internal module
			for (const instance_id of referencedInstanceIds) {
				instancesExport[instance_id] = this.instance.exportInstance(instance_id, minimalExport) || {}
			}

			referencedInstanceLabels.delete('internal') // Ignore the internal module
			for (const label of referencedInstanceLabels) {
				const instance_id = this.instance.getIdForLabel(label)
				if (instance_id) {
					instancesExport[instance_id] = this.instance.exportInstance(instance_id, minimalExport) || {}
				}
			}

			return instancesExport
		}

		/**
		 *
		 * @param {*} triggerControls
		 * @returns {import('./Model/ExportModel.js').ExportTriggersListv4}
		 */
		const generate_export_for_triggers = (triggerControls) => {
			/** @type {Record<string, import('./Model/ExportModel.js').ExportTriggerContentv4>} */
			const triggersExport = {}
			const referencedInstanceIds = new Set()
			const referencedInstanceLabels = new Set()
			for (const control of triggerControls) {
				const parsedId = ParseControlId(control.controlId)
				if (parsedId?.type === 'trigger') {
					triggersExport[parsedId.trigger] = control.toJSON(false)

					control.collectReferencedInstances(referencedInstanceIds, referencedInstanceLabels)
				}
			}

			const instancesExport = generate_export_for_referenced_instances(referencedInstanceIds, referencedInstanceLabels)

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

			downloadBlob(this.logger, res, next, exp, filename, req.query.format)
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

				downloadBlob(this.logger, res, next, exp, filename, req.query.format)
			} else {
				next()
			}
		})

		this.registry.api_router.get('/export/page/:page', (req, res, next) => {
			const page = Number(req.params.page)
			if (isNaN(page)) {
				next()
			} else {
				const pageInfo = this.page.getPage(page, true)
				if (!pageInfo) throw new Error(`Page "${page}" not found!`)

				const referencedInstanceIds = new Set()
				const referencedInstanceLabels = new Set()

				const pageExport = generatePageExportInfo(pageInfo, referencedInstanceIds, referencedInstanceLabels)

				const instancesExport = generate_export_for_referenced_instances(
					referencedInstanceIds,
					referencedInstanceLabels
				)

				// Export file protocol version
				/** @type {import('./Model/ExportModel.js').ExportPageModelv4} */
				const exp = {
					version: FILE_VERSION,
					type: 'page',
					page: pageExport,
					instances: instancesExport,
					oldPageNumber: page,
				}

				const filename = encodeURI(`${os.hostname()}_page${page}_${getTimestamp()}.companionconfig`)

				downloadBlob(this.logger, res, next, exp, filename, req.query.format)
			}
		})

		/**
		 * @param {Readonly<import('./Model/PageModel.js').PageModel>} pageInfo
		 * @param {Set<string>} referencedInstanceIds
		 * @param {Set<string>} referencedInstanceLabels
		 * @returns {import('./Model/ExportModel.js').ExportPageContentv4}
		 */
		const generatePageExportInfo = (pageInfo, referencedInstanceIds, referencedInstanceLabels) => {
			/** @type {import('./Model/ExportModel.js').ExportPageContentv4} */
			const pageExport = {
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

						control.collectReferencedInstances(referencedInstanceIds, referencedInstanceLabels)
					}
				}
			}

			return pageExport
		}

		/**
		 *
		 * @param {ClientExportSelection | null} config
		 * @returns
		 */
		const generateCustomExport = (config) => {
			// Export file protocol version
			/** @type {import('./Model/ExportModel.js').ExportFullv4} */
			const exp = {
				version: FILE_VERSION,
				type: 'full',
			}

			const rawControls = this.controls.getAllControls()

			const referencedInstanceIds = new Set()
			const referencedInstanceLabels = new Set()

			if (!config || !isFalsey(config.buttons)) {
				exp.pages = {}

				const pageInfos = this.page.getAll()
				for (const [pageNumber, rawPageInfo] of Object.entries(pageInfos)) {
					exp.pages[Number(pageNumber)] = generatePageExportInfo(
						rawPageInfo,
						referencedInstanceIds,
						referencedInstanceLabels
					)
				}
			}

			if (!config || !isFalsey(config.triggers)) {
				/** @type {Record<string, import('./Model/ExportModel.js').ExportTriggerContentv4>} */
				const triggersExport = {}
				for (const control of rawControls.values()) {
					if (control.type === 'trigger') {
						const parsedId = ParseControlId(control.controlId)
						if (parsedId?.type === 'trigger') {
							triggersExport[parsedId.trigger] = control.toJSON(false)

							control.collectReferencedInstances(referencedInstanceIds, referencedInstanceLabels)
						}
					}
				}
				exp.triggers = triggersExport
			}

			if (!config || !isFalsey(config.customVariables)) {
				exp.custom_variables = this.instance.variable.custom.getDefinitions()
			}

			if (!config || !isFalsey(config.connections)) {
				exp.instances = this.instance.exportAll(false)
			} else {
				exp.instances = generate_export_for_referenced_instances(referencedInstanceIds, referencedInstanceLabels, true)
			}

			if (!config || !isFalsey(config.surfaces)) {
				exp.surfaces = this.surfaces.exportAll(false)
			}

			return exp
		}

		this.registry.api_router.get('/export/custom', (req, res, next) => {
			const exp = generateCustomExport(req.query)

			const filename = encodeURI(`${os.hostname()}_custom-config_${getTimestamp()}.companionconfig`)

			downloadBlob(this.logger, res, next, exp, filename, req.query.format)
		})

		this.registry.api_router.get('/export/full', (req, res, next) => {
			const exp = generateCustomExport(null)

			const filename = encodeURI(`${os.hostname()}full-config_${getTimestamp()}.companionconfig`)

			downloadBlob(this.logger, res, next, exp, filename, req.query.format)
		})

		this.registry.api_router.get('/export/log', (_req, res, _next) => {
			const logs = this.registry.log.getAllLines()

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
				const logs = this.registry.log.getAllLines()

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

	/**
	 *
	 * @template T
	 * @param {'reset' | 'import'} newTaskType
	 * @param {() => Promise<T>} executeFn
	 * @returns {Promise<T>}
	 */
	async checkOrRunImportTask(newTaskType, executeFn) {
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
	 *
	 * @param {number} pageCount
	 * @returns {void}
	 */
	createInitialPageButtons(pageCount) {
		for (let page = 0; page < pageCount; page++) {
			// TODO - is this off by one?
			for (const definition of default_nav_buttons_definitions) {
				const location = {
					...definition.location,
					pageNumber: page,
				}
				const oldControlId = this.page.getControlIdAt(location)
				if (oldControlId) this.controls.deleteControl(oldControlId)

				this.controls.createBankControl(location, definition.type)
			}
		}
	}

	/**
	 * Setup a new socket client's events
	 * @param {import('../UI/Handler.js').ClientSocket} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		if (this.#currentImportTask) {
			// Inform about in progress task
			client.emit('load-save:task', this.#currentImportTask)
		}

		/** @type {ClientPendingImport | null} */
		let clientPendingImport = null

		client.onPromise('loadsave:abort', () => {
			if (clientPendingImport) {
				// TODO - stop timer
				clientPendingImport = null
			}

			return true
		})
		client.onPromise(
			'loadsave:prepare-import',
			/**
			 *
			 * @param {*} dataStr
			 * @returns {Promise<[null, ClientImportObject] | [string]>}
			 */
			async (dataStr) => {
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
					/** @type {import('./Model/ExportModel.js').ExportFullv4} */
					object = {
						type: 'full',
						version: FILE_VERSION,
						triggers: object.triggers,
						instances: object.instances,
					}
				}

				// Store the object on the client
				clientPendingImport = {
					object,
					timeout: null, // TODO
				}

				// Build a minimal object to send back to the client
				/** @type {ClientImportObject} */
				const clientObject = {
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
					}
				}

				/**
				 * @param {import('./Model/ExportModel.js').ExportPageContentv4} pageInfo
				 * @returns {ClientPageInfo}
				 */
				function simplifyPageForClient(pageInfo) {
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
			}
		)

		client.onPromise(
			'loadsave:control-preview',
			/**
			 *
			 * @param {import('../Resources/Util.js').ControlLocation} location
			 * @returns {Promise<string | null>} Image as data-url
			 */
			async (location) => {
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
				return !!res?.style ? res?.asDataUrl ?? null : null
			}
		)

		client.onPromise(
			'loadsave:reset-page-clear',
			/**
			 * @param {number} pageNumber
			 * @returns {'ok'}
			 */
			(pageNumber) => {
				this.logger.silly(`Reset page ${pageNumber}`)
				const controlIds = this.page.getAllControlIdsOnPage(pageNumber)
				for (const controlId of controlIds) {
					this.controls.deleteControl(controlId)
				}

				this.page.resetPage(pageNumber)

				for (const { type, location } of default_nav_buttons_definitions) {
					this.controls.createBankControl(
						{
							pageNumber,
							...location,
						},
						type
					)
				}

				return 'ok'
			}
		)

		client.onPromise(
			'loadsave:reset-page-nav',
			/**
			 * @param {number} pageNumber
			 * @returns {'ok'}
			 */
			(pageNumber) => {
				this.page.resetPage(pageNumber)

				// make magical page buttons!
				for (const { type, location } of default_nav_buttons_definitions) {
					this.controls.createBankControl(
						{
							pageNumber,
							...location,
						},
						type
					)
				}

				return 'ok'
			}
		)

		client.onPromise(
			'loadsave:reset',
			/**
			 * @param {ClientResetSelection} config
			 * @returns {Promise<'ok'>}
			 */
			(config) => {
				if (!config) throw new Error('Missing reset config')

				return this.checkOrRunImportTask('reset', async () => {
					return this.#reset(config)
				})
			}
		)

		client.onPromise(
			'loadsave:import-full',
			/**
			 * @param {ClientImportSelection | null} config
			 * @returns {Promise<void>}
			 */
			async (config) => {
				return this.checkOrRunImportTask('import', async () => {
					const data = clientPendingImport?.object
					if (!data) throw new Error('No in-progress import object')

					if (data.type !== 'full') throw new Error('Invalid import object')

					// Destroy old stuff
					await this.#reset(undefined, !config || config.buttons)

					// import custom variables
					if (!config || config.customVariables) {
						this.instance.variable.custom.replaceDefinitions(data.custom_variables || {})
					}

					// Always Import instances
					const instanceIdMap = this.#importInstances(data.instances, {})

					if (data.pages && (!config || config.buttons)) {
						// Import pages
						for (let page = 1; page <= 99; page++) {
							doPageImport(data.pages[page], page, instanceIdMap)
						}
					}

					if (!config || config.surfaces) {
						for (const [id, surface] of Object.entries(data.surfaces || {})) {
							this.surfaces.importSurface(id, surface)
						}
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
			}
		)

		/**
		 * @param {import('./Model/ExportModel.js').ExportPageContentv4} pageInfo
		 * @param {number} topage
		 * @param {InstanceAppliedRemappings} instanceIdMap
		 * @returns {void}
		 */
		const doPageImport = (pageInfo, topage, instanceIdMap) => {
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
					const updatedSize = {}
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
				this.page.importPage(topage, pageInfo)

				// Import the controls
				for (const [row, rowObj] of Object.entries(pageInfo.controls)) {
					for (const [column, control] of Object.entries(rowObj)) {
						if (control) {
							// Import the control
							const fixedControlObj = this.#fixupControl(cloneDeep(control), instanceIdMap)

							/** @type {import('../Resources/Util.js').ControlLocation} */
							const location = {
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

		client.onPromise(
			'loadsave:import-page',
			/**
			 * @param {number} topage
			 * @param {number} frompage
			 * @param {InstanceRemappings} instanceRemapping
			 * @returns {Promise<InstanceRemappings>}
			 */
			async (topage, frompage, instanceRemapping) => {
				return this.checkOrRunImportTask('import', async () => {
					const data = clientPendingImport?.object
					if (!data) throw new Error('No in-progress import object')

					if (topage <= 0 || topage > 99) throw new Error('Invalid target page')

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
					/** @type {InstanceRemappings} */
					const instanceRemap2 = {}
					for (const [id, obj] of Object.entries(instanceIdMap)) {
						instanceRemap2[id] = obj.id
					}

					return instanceRemap2
				})
			}
		)

		client.onPromise(
			'loadsave:import-triggers',
			/**
			 * @param {string[]} idsToImport0
			 * @param {InstanceRemappings} instanceRemapping
			 * @param {boolean} replaceExisting
			 * @returns {Promise<InstanceRemappings>}
			 */
			async (idsToImport0, instanceRemapping, replaceExisting) => {
				return this.checkOrRunImportTask('import', async () => {
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

						const controlId = CreateTriggerControlId(id)
						const fixedControlObj = this.#fixupTriggerControl(trigger, instanceIdMap)
						this.controls.importTrigger(controlId, fixedControlObj)
					}

					// Report the used remap to the ui, for future imports
					/** @type {InstanceRemappings} */
					const instanceRemap2 = {}
					for (const [id, obj] of Object.entries(instanceIdMap)) {
						instanceRemap2[id] = obj.id
					}

					return instanceRemap2
				})
			}
		)
	}

	/**
	 *
	 * @param {ClientResetSelection | undefined} config
	 * @param {boolean} skipNavButtons
	 * @returns {Promise<'ok'>}
	 */
	async #reset(config, skipNavButtons = false) {
		const controls = this.controls.getAllControls()

		if (!config || config.buttons) {
			for (const [controlId, control] of controls.entries()) {
				if (control.type !== 'trigger') {
					this.controls.deleteControl(controlId)
				}
			}

			for (let pageNumber = 1; pageNumber <= 99; ++pageNumber) {
				this.page.resetPage(pageNumber)

				if (!skipNavButtons) {
					for (const { type, location } of default_nav_buttons_definitions) {
						this.controls.createBankControl(
							{
								pageNumber,
								...location,
							},
							type
						)
					}
				}
			}

			// reset the size
			this.userconfig.resetKey('gridSize')
		}

		if (!config || config.connections) {
			await this.instance.deleteAllInstances()
		}

		if (!config || config.surfaces) {
			this.surfaces.reset()
		}

		if (!config || config.triggers) {
			for (const [controlId, control] of controls.entries()) {
				if (control.type === 'trigger') {
					this.controls.deleteControl(controlId)
				}
			}
		}

		if (!config || config.customVariables) {
			this.instance.variable.custom.reset()
		}

		if (!config || config.userconfig) {
			this.userconfig.reset()
		}

		return 'ok'
	}

	/**
	 * @param {import('./Model/ExportModel.js').ExportInstancesv4 | undefined} instances
	 * @param {InstanceRemappings} instanceRemapping
	 * @returns {InstanceAppliedRemappings}
	 */
	#importInstances(instances, instanceRemapping) {
		/** @type {InstanceAppliedRemappings} */
		const instanceIdMap = {}

		if (instances) {
			for (const [oldId, obj] of Object.entries(instances)) {
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
					const newId = this.instance.addInstance({ type: instance_type }, true)
					console.log('created', instance_type, newId)
					if (newId) {
						const newLabel = this.instance.makeLabelUnique(obj.label, newId)
						this.instance.setInstanceLabelAndConfig(newId, newLabel, 'config' in obj ? obj.config : null)

						if (!('enabled' in obj) || obj.enabled !== false) {
							this.instance.enableDisableInstance(newId, true)
						}

						instanceIdMap[oldId] = {
							id: newId,
							label: newLabel,
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

	/**
	 * @param {Readonly<import('./Model/ExportModel.js').ExportTriggerContentv4>} control
	 * @param {InstanceAppliedRemappings} instanceIdMap
	 * @returns {import('./Model/TriggerModel.js').TriggerModel}
	 */
	#fixupTriggerControl(control, instanceIdMap) {
		// Future: this does not feel durable

		/** @type {Record<string, string>} */
		const instanceLabelRemap = {}
		/** @type {Record<string, string>} */
		const instanceIdRemap = {}
		for (const [oldId, info] of Object.entries(instanceIdMap)) {
			if (info.oldLabel && info.label !== info.oldLabel) {
				instanceLabelRemap[info.oldLabel] = info.label
			}
			if (info.id && info.id !== oldId) {
				instanceIdRemap[oldId] = info.id
			}
		}

		/** @type {import('./Model/TriggerModel.js').TriggerModel} */
		const result = {
			type: 'trigger',
			options: cloneDeep(control.options),
			action_sets: {},
			condition: [],
			events: control.events,
		}

		if (control.condition) {
			/** @type {import('./Model/FeedbackModel.js').FeedbackInstance[]} */
			const newFeedbacks = []
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

		/** @type {import('./Model/ActionModel.js').ActionInstance[]} */
		const allActions = []
		if (control.action_sets) {
			for (const [setId, action_set] of Object.entries(control.action_sets)) {
				/** @type {import('./Model/ActionModel.js').ActionInstance[]} */
				const newActions = []
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
				result.action_sets[setId] = newActions
				allActions.push(...newActions)
			}
		}

		this.fixupControlReferences(
			{
				instanceLabels: instanceLabelRemap,
				instanceIds: instanceIdRemap,
			},
			undefined,
			allActions,
			result.condition || [],
			result.events || [],
			false
		)

		return result
	}

	/**
	 * @param {import('./Model/ExportModel.js').ExportControlv4 } control
	 * @param {InstanceAppliedRemappings} instanceIdMap
	 * @returns {import('./Model/ButtonModel.js').SomeButtonModel}
	 */
	#fixupControl(control, instanceIdMap) {
		// Future: this does not feel durable

		if (control.type === 'pagenum' || control.type === 'pageup' || control.type === 'pagedown') {
			return {
				type: control.type,
			}
		}

		/** @type {Record<string, string>} */
		const instanceLabelRemap = {}
		/** @type {Record<string, string>} */
		const instanceIdRemap = {}
		for (const [oldId, info] of Object.entries(instanceIdMap)) {
			if (info.oldLabel && info.label !== info.oldLabel) {
				instanceLabelRemap[info.oldLabel] = info.label
			}
			if (info.id && info.id !== oldId) {
				instanceIdRemap[oldId] = info.id
			}
		}

		/** @type {import('./Model/ButtonModel.js').NormalButtonModel} */
		const result = {
			type: 'button',
			options: cloneDeep(control.options),
			style: cloneDeep(control.style),
			feedbacks: [],
			steps: {},
		}

		if (control.feedbacks) {
			/** @type {import('./Model/FeedbackModel.js').FeedbackInstance[]} */
			const newFeedbacks = []
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

		/** @type {import('./Model/ActionModel.js').ActionInstance[]} */
		const allActions = []
		if (control.steps) {
			for (const [stepId, step] of Object.entries(control.steps)) {
				/** @type {import('./Model/ActionModel.js').ActionSetsModel} */
				const newStepSets = {}
				result.steps[stepId] = {
					action_sets: newStepSets,
					options: cloneDeep(step.options),
				}

				for (const [setId, action_set] of Object.entries(step.action_sets)) {
					/** @type {import('./Model/ActionModel.js').ActionInstance[]} */
					const newActions = []
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

		this.fixupControlReferences(
			{
				instanceLabels: instanceLabelRemap,
				instanceIds: instanceIdRemap,
			},
			result.style,
			allActions,
			result.feedbacks || [],
			undefined,
			false
		)

		return result
	}

	/**
	 * Visit any references within the given control
	 * @param {import('../Internal/Types.js').InternalVisitor} visitor Visitor to be used
	 * @param {import('./Model/StyleModel.js').ButtonStyleProperties | undefined} style Style object of the control (if any)
	 * @param {import('./Model/ActionModel.js').ActionInstance[]} actions Array of actions belonging to the control
	 * @param {import('./Model/FeedbackModel.js').FeedbackInstance[]} feedbacks Array of feedbacks belonging to the control
	 * @param {import('./Model/EventModel.js').EventInstance[] | undefined} events Array of events belonging to the control
	 */
	visitControlReferences(visitor, style, actions, feedbacks, events) {
		// Update the base style
		if (style) visitor.visitString(style, 'text')

		// Apply any updates to the internal actions/feedbacks
		this.internalModule.visitReferences(visitor, actions, feedbacks)

		for (const feedback of feedbacks) {
			// Fixup any boolean feedbacks
			if (feedback.style?.text) {
				visitor.visitString(feedback.style, 'text')
			}

			// Fixup any references in feedback options
			for (const key of Object.keys(feedback.options || {})) {
				visitor.visitString(feedback.options, key, feedback.id)
			}
		}

		// Fixup any references in action options
		for (const action of actions) {
			for (const key of Object.keys(action.options || {})) {
				visitor.visitString(action.options, key)
			}
		}

		// Fixup any references in event options
		for (const event of events || []) {
			visitEventOptions(visitor, event)
		}
	}

	/**
	 * Fixup any references within the given control
	 * @param {FixupReferencesUpdateMaps} updateMaps Description of instance ids and labels to remap
	 * @param {import('./Model/StyleModel.js').ButtonStyleProperties | undefined} style Style object of the control (if any)
	 * @param {import('./Model/ActionModel.js').ActionInstance[]} actions Array of actions belonging to the control
	 * @param {import('./Model/FeedbackModel.js').FeedbackInstance[]} feedbacks Array of feedbacks belonging to the control
	 * @param {import('./Model/EventModel.js').EventInstance[] | undefined} events Array of events belonging to the control
	 * @param {boolean} recheckChangedFeedbacks Whether to recheck the feedbacks that were modified
	 * @returns {boolean} Whether any changes were made
	 */
	fixupControlReferences(updateMaps, style, actions, feedbacks, events, recheckChangedFeedbacks) {
		const visitor = new VisitorReferencesUpdater(updateMaps.instanceLabels, updateMaps.instanceIds)

		this.visitControlReferences(visitor, style, actions, feedbacks, events)

		// Trigger the feedbacks to be rechecked, this will cause a redraw if needed
		if (recheckChangedFeedbacks && visitor.changedFeedbackIds.size > 0) {
			this.internalModule.checkFeedbacksById(...visitor.changedFeedbackIds)
		}

		return visitor.changed
	}
}

export default DataImportExport

/**
 * @typedef {Record<string, string | undefined>} InstanceRemappings
 * @typedef {Record<string, { id: string, label: string, lastUpgradeIndex?: number, oldLabel?: string}>} InstanceAppliedRemappings
 * 
 * @typedef {{
 *   instanceLabels?: Record<string, string>
 *   instanceIds?: Record<string, string>
 * }} FixupReferencesUpdateMaps
 * 
 * @typedef {{
 *   name: string
 *   gridSize: import('./Model/ExportModel.js').ExportGridSize
 * }} ClientPageInfo 
 * 
 * @typedef {{
 *   type: 'page' | 'full' | 'trigger_list'
 *   instances: Record<string, { label: string, instance_type: string }>
 *   controls: boolean
 *   customVariables: boolean
 *   surfaces: boolean
 *   triggers: boolean | Record<string, { name: string }>
 *   oldPageNumber?: number
 *   page?: ClientPageInfo
 *   pages?: Record<number, ClientPageInfo>
 * }} ClientImportObject
 * 
 * @typedef {{
 *   buttons: boolean
 *   customVariables: boolean
 *   surfaces: boolean
 *   triggers: boolean
 * }} ClientImportSelection
 * 
 * @typedef {{
 *   buttons: boolean
 *   triggers: boolean
 *   customVariables: boolean
 *   connections: boolean
 *   surfaces: boolean
* }} ClientExportSelection

 * @typedef {{
 *   buttons: boolean
 *   connections: boolean
 *   surfaces: boolean
 *   triggers: boolean
 *   customVariables: boolean
 *   userconfig: boolean
 * }} ClientResetSelection
 * 
 * @typedef {{
 *   object: import('./Model/ExportModel.js').ExportFullv4 | import('./Model/ExportModel.js').ExportPageModelv4 
 *   timeout: null
 * }} ClientPendingImport
 */
