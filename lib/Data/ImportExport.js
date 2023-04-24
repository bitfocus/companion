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

const FILE_VERSION = 3

import os from 'os'
import { upgradeImport } from '../Data/Upgrade.js'
import { cloneDeep } from 'lodash-es'
import { getTimestamp, isFalsey } from '../Resources/Util.js'
import { CreateBankControlId, CreateTriggerControlId, ParseControlId } from '../Shared/ControlId.js'
import CoreBase from '../Core/Base.js'
import Registry from '../Registry.js'
import archiver from 'archiver'
import { nanoid } from 'nanoid'
import { VisitorReferencesUpdater } from '../Util/Visitors/ReferencesUpdater.js'
import path from 'path'
import fs from 'fs'
import zlib from 'node:zlib'

/**
 * Default buttons on fresh pages
 */
const default_nav_buttons = {
	1: 'pageup',
	9: 'pagenum',
	17: 'pagedown',
}

function downloadBlob(res, next, data, filename, format) {
	const dataStr = JSON.stringify(data, undefined, '\t')

	if (!format || format === 'json-gz') {
		zlib.gzip(dataStr, (err, result) => {
			if (err) {
				this.logger.warn(`Failed to gzip data, retrying uncompressed: ${err}`)
				downloadBlob(res, next, data, filename, 'json')
			} else {
				res.writeHeader(200, {
					'Content-Type': 'application/gzip',
					'Content-Disposition': `attachment; filename="${filename}"`,
				})
				res.end(result)
			}
		})
	} else if (format === 'json') {
		res.writeHeader(200, {
			'Content-Type': 'application/json',
			'Content-Disposition': `attachment; filename="${filename}"`,
		})
		res.end(dataStr)
	} else {
		next(new Error(`Unknown format: ${format}`))
	}
}

class DataImportExport extends CoreBase {
	/**
	 * If there is a current import task that clients should be aware of, this will be set
	 * Possible values: 'reset' | 'import'
	 * @access private
	 */
	#currentImportTask = null

	constructor(registry) {
		super(registry, 'import/export', 'Data/ImportExport')

		const generate_export_for_referenced_instances = (
			referencedInstanceIds,
			referencedInstanceLabels,
			minimalExport
		) => {
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

		const generate_export_for_triggers = (triggerControls) => {
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
			const triggerControls = Object.values(this.controls.getAllControls()).filter((c) => c.type === 'trigger')
			const exp = generate_export_for_triggers(triggerControls)

			const filename = encodeURI(`${os.hostname()}_trigger_list_${getTimestamp()}.companionconfig`)

			downloadBlob(res, next, exp, filename, req.query.format)
		})

		this.registry.api_router.get('/export/triggers/single/:id', (req, res, next) => {
			const controlId = CreateTriggerControlId(req.params.id)
			const control = this.controls.getControl(controlId)
			if (control) {
				const exp = generate_export_for_triggers([control])

				const filename = encodeURI(
					`${os.hostname()}_trigger_${control.options.name
						.toLowerCase()
						.replace(/\W/, '')}_${getTimestamp()}.companionconfig`
				)

				downloadBlob(res, next, exp, filename, req.query.format)
			} else {
				next()
			}
		})

		this.registry.api_router.get('/export/page/:page', (req, res, next) => {
			const page = Number(req.params.page)
			if (isNaN(page)) {
				next()
			} else {
				const controlsOnPage = this.controls.getForPage(page)

				const controlsExport = {}
				const referencedInstanceIds = new Set()
				const referencedInstanceLabels = new Set()
				for (const control of controlsOnPage) {
					controlsExport[control.controlId] = control.toJSON(false)

					control.collectReferencedInstances(referencedInstanceIds, referencedInstanceLabels)
				}

				const instancesExport = generate_export_for_referenced_instances(
					referencedInstanceIds,
					referencedInstanceLabels
				)

				// Export file protocol version
				const exp = {
					version: FILE_VERSION,
					type: 'page',
					controls: controlsExport,
					page: this.page.getPage(page, false),
					instances: instancesExport,
					oldPageNumber: page,
				}

				const filename = encodeURI(`${os.hostname()}_page${page}_${getTimestamp()}.companionconfig`)

				downloadBlob(res, next, exp, filename, req.query.format)
			}
		})

		const generateCustomExport = (config) => {
			// Export file protocol version
			const exp = {
				version: FILE_VERSION,
				type: 'full',
			}

			const rawControls = this.controls.getAllControls()

			const referencedInstanceIds = new Set()
			const referencedInstanceLabels = new Set()

			if (!config || !isFalsey(config.buttons)) {
				exp.pages = this.page.getAll(false)

				const controlsExport = {}
				for (const [id, control] of Object.entries(rawControls)) {
					if (control.type !== 'trigger') {
						controlsExport[id] = control.toJSON(false)

						control.collectReferencedInstances(referencedInstanceIds, referencedInstanceLabels)
					}
				}
				exp.controls = controlsExport
			}

			if (!config || !isFalsey(config.triggers)) {
				const triggersExport = {}
				for (const control of Object.values(rawControls)) {
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

			downloadBlob(res, next, exp, filename, req.query.format)
		})

		this.registry.api_router.get('/export/full', (req, res, next) => {
			const exp = generateCustomExport(null)

			const filename = encodeURI(`${os.hostname()}full-config_${getTimestamp()}.companionconfig`)

			downloadBlob(res, next, exp, filename, req.query.format)
		})

		this.registry.api_router.get('/export/log', (req, res, next) => {
			const logs = this.registry.log.getAllLines()

			const filename = encodeURI(`${os.hostname()}_companion_log_${getTimestamp()}.csv`)

			res.writeHeader(200, {
				'Content-Type': 'text/csv',
				'Content-Disposition': `attachment; filename="${filename}"`,
			})

			let out = `"Date","Module","Type","Log"\r\n`

			for (const line of logs) {
				out += `${new Date(line.time).toISOString()},"${line.source}","${line.level}","${line.message}"\r\n`
			}

			res.end(out)
		})

		this.registry.api_router.get('/export/support', (req, res, next) => {
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
					cwd: this.registry.configDir,
					nodir: true,
					ignore: [
						'cloud', // Ignore companion-cloud credentials
					],
				},
				{}
			)

			// Add the logs if found
			const logsDir = path.join(this.registry.configDir, '../logs')
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
				const payload = this.registry.ui.update.getPayload()
				let out = JSON.stringify(payload)
				archive.append(out, { name: 'user.json' })
			} catch (e) {
				this.logger.debug(`Support bundle append user: ${e}`)
			}

			archive.finalize()
		})
	}

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
	 * Setup a new socket client's events
	 * @param {SocketIO} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		if (this.#currentImportTask) {
			// Inform about in progress task
			client.emit('load-save:task', this.#currentImportTask)
		}

		client.onPromise('loadsave:abort', () => {
			if (client.pendingImport) {
				// TODO - stop timer
				delete client.pendingImport
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

			let object
			try {
				object = JSON.parse(dataStr.toString())
			} catch (e) {
				return ['File is corrupted or unknown format']
			}

			if (object.version > FILE_VERSION) {
				return ['File was saved with a newer unsupported version of Companion']
			}

			if (object.type !== 'full' && object.type !== 'page' && object.type !== 'trigger_list') {
				return ['Unknown import type']
			}

			object = upgradeImport(object)

			// TODO - this should be an upgrade, but isnt enough to justify a version bump
			if (object.triggers && Array.isArray(object.triggers)) {
				const triggersObj = {}
				for (const trigger of object.triggers) {
					triggersObj[nanoid()] = trigger
				}
				object.triggers = triggersObj
			}

			// Store the object on the client
			client.pendingImport = {
				object,
				timeout: null, // TODO
			}

			// Build a minimal object to send back to the client
			const clientObject = {
				type: object.type,
				instances: {},
				controls: !!object.controls,
				customVariables: !!object.custom_variables,
				surfaces: !!object.surfaces,
				triggers: !!object.triggers,
			}

			for (const [instanceId, instance] of Object.entries(object.instances || {})) {
				if (instanceId === 'internal' || instanceId === 'bitfocus-companion') continue

				clientObject.instances[instanceId] = {
					instance_type: this.instance.modules.verifyInstanceTypeIsCurrent(instance.instance_type),
					label: instance.label,
				}
			}

			if (object.type === 'page') {
				clientObject.page = object.page
				clientObject.oldPageNumber = object.oldPageNumber || 1
			} else {
				clientObject.pages = object.pages

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

			if (object.type === 'trigger_list') {
				clientObject.type = 'full'
			}

			// rest is done from browser
			return [null, clientObject]
		})

		client.onPromise('loadsave:control-preview', (controlId) => {
			const importObject = client.pendingImport?.object
			const controlObj = importObject?.controls?.[controlId]

			if (controlObj) {
				const res = this.graphics.drawPreview({
					...controlObj.style,
					style: controlObj.type,
				})
				return res?.buffer ?? null
			} else {
				const res = this.graphics.drawPreview({})
				return res?.buffer ?? null
			}
		})

		client.onPromise('loadsave:reset-page-clear', (page) => {
			this.logger.silly(`Reset page ${page}`)
			for (let i = 1; i <= global.MAX_BUTTONS; ++i) {
				const newStyle = default_nav_buttons[i]
				this.controls.resetControl(CreateBankControlId(page, i), newStyle)
			}

			this.page.setPage(page, null)

			return 'ok'
		})

		client.onPromise('loadsave:reset-page-nav', (page) => {
			// make magical page buttons!
			for (const [bank, style] of Object.entries(default_nav_buttons)) {
				if (style) {
					this.controls.resetControl(CreateBankControlId(page, bank), style)
				}
			}

			this.page.setPage(page, null)

			return 'ok'
		})

		client.onPromise('loadsave:reset', (config) => {
			if (!config) throw new Error('Missing reset config')

			return this.checkOrRunImportTask('reset', async () => {
				return this.#reset(config)
			})
		})

		client.onPromise('loadsave:import-full', async (config) => {
			return this.checkOrRunImportTask('import', async () => {
				const data = client.pendingImport?.object
				if (!data) throw new Error('No in-progress import object')

				if (data.type !== 'full' && data.type !== 'trigger_list') throw new Error('Invalid import object')

				// Destroy old stuff
				await this.#reset(undefined, !config || config.buttons)

				// import custom variables
				if (!config || config.customVariables) {
					this.instance.variable.custom.replaceDefinitions(data.custom_variables || {})
				}

				// Always Import instances
				const instanceIdMap = this.#importInstances(data.instances, {})

				if (data.controls && (!config || config.buttons)) {
					// Import page names
					for (let page = 1; page <= 99; page++) {
						this.page.setPage(page, cloneDeep(data.pages?.[page]))
					}

					// Import controls
					for (const [controlId, control] of Object.entries(data.controls)) {
						const fixedControlObj = this.#fixupControl('bank', cloneDeep(control), instanceIdMap)
						this.controls.importControl(controlId, fixedControlObj)
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
						const fixedControlObj = this.#fixupControl('trigger', cloneDeep(trigger), instanceIdMap)
						this.controls.importTrigger(controlId, fixedControlObj)
					}
				}

				// trigger startup triggers to run
				setImmediate(() => {
					this.controls.triggers.emit('startup')
				})
			})
		})

		client.onPromise('loadsave:import-page', (topage, frompage, instanceRemapping) => {
			return this.checkOrRunImportTask('import', async () => {
				const data = client.pendingImport?.object
				if (!data) throw new Error('No in-progress import object')

				if (topage <= 0 || topage > 99) throw new Error('Invalid target page')

				if (data.type === 'full' && data.pages) {
					this.page.setPage(topage, data.pages[frompage])

					// continue below
				} else if (data.type === 'page') {
					this.page.setPage(topage, data.page)

					frompage = data.oldPageNumber || 1

					// continue below
				} else {
					throw new Error('Cannot import page ')
				}

				// Setup the new instances
				const instanceIdMap = this.#importInstances(data.instances, instanceRemapping)

				// Importing the controls is the same for both
				for (let bank = 1; bank <= global.MAX_BUTTONS; bank++) {
					const fromControlId = CreateBankControlId(frompage, bank)
					const toControlId = CreateBankControlId(topage, bank)

					const oldControl = cloneDeep(data.controls[fromControlId])
					if (oldControl) {
						// Import the control
						const fixedControlObj = this.#fixupControl('bank', oldControl, instanceIdMap)
						this.controls.importControl(toControlId, fixedControlObj)
					} else {
						// Clear the target
						this.controls.resetControl(toControlId)
					}
				}

				// Report the used remap to the ui, for future imports
				const instanceRemap2 = {}
				for (const [id, obj] of Object.entries(instanceIdMap)) {
					instanceRemap2[id] = obj.id
				}

				return instanceRemap2
			})
		})

		client.onPromise('loadsave:import-triggers', (idsToImport0, instanceRemapping, replaceExisting) => {
			return this.checkOrRunImportTask('import', async () => {
				const data = client.pendingImport?.object
				if (!data) throw new Error('No in-progress import object')

				if (!data.triggers) throw new Error('No triggers in import')

				// Remove existing triggers
				if (replaceExisting) {
					const controls = this.controls.getAllControls()
					for (const [controlId, control] of Object.entries(controls)) {
						if (control.type === 'trigger') {
							this.controls.resetControl(controlId, undefined)
						}
					}
				}

				// Setup the new instances
				const instanceIdMap = this.#importInstances(data.instances, instanceRemapping)

				const idsToImport = new Set(idsToImport0)
				for (const id of idsToImport) {
					const trigger = data.triggers[id]

					const controlId = CreateTriggerControlId(id)
					const fixedControlObj = this.#fixupControl('trigger', cloneDeep(trigger), instanceIdMap)
					this.controls.importTrigger(controlId, fixedControlObj)
				}

				// Report the used remap to the ui, for future imports
				const instanceRemap2 = {}
				for (const [id, obj] of Object.entries(instanceIdMap)) {
					instanceRemap2[id] = obj.id
				}

				return instanceRemap2
			})
		})
	}

	loadData() {
		this.instanceData = this.db.getKey('instance')
	}

	async #reset(config, skipNavButtons = false) {
		const controls = this.controls.getAllControls()

		if (!config || config.buttons) {
			for (const [controlId, control] of Object.entries(controls)) {
				if (control.type !== 'trigger') {
					this.controls.resetControl(controlId, undefined)
				}
			}

			for (let page = 1; page <= 99; ++page) {
				this.page.setPage(page, null)

				if (!skipNavButtons) {
					for (const [bank, newStyle] of Object.entries(default_nav_buttons)) {
						this.controls.resetControl(CreateBankControlId(page, bank), newStyle)
					}
				}
			}
		}

		if (!config || config.connections) {
			await this.instance.deleteAllInstances()
		}

		if (!config || config.surfaces) {
			this.surfaces.reset()
		}

		if (!config || config.triggers) {
			for (const [controlId, control] of Object.entries(controls)) {
				if (control.type === 'trigger') {
					this.controls.resetControl(controlId, undefined)
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

	#importInstances(instances, instanceRemapping) {
		const instanceIdMap = {}

		for (const [oldId, obj] of Object.entries(instances)) {
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
					this.instance.setInstanceLabelAndConfig(newId, newLabel, obj.config)

					if (obj.enabled !== false) {
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

		// Force the internal module mapping
		instanceIdMap['internal'] = { id: 'internal', label: 'internal' }
		instanceIdMap['bitfocus-companion'] = { id: 'internal', label: 'internal' }

		return instanceIdMap
	}

	#fixupControl(controlType, control, instanceIdMap) {
		// Future: this does not feel durable

		const instanceLabelRemap = {}
		const instanceIdRemap = {}
		for (const [oldId, info] of Object.entries(instanceIdMap)) {
			if (info.label !== info.oldLabel) {
				instanceLabelRemap[info.oldLabel] = info.label
			}
			if (info.id && info.id !== oldId) {
				instanceIdRemap[oldId] = info.id
			}
		}

		if (controlType === 'trigger') {
			if (control.condition) {
				const newFeedbacks = []
				for (const feedback of control.condition) {
					const instanceInfo = instanceIdMap[feedback?.instance_id]
					if (feedback && instanceInfo) {
						feedback.instance_id = instanceInfo.id
						feedback.upgradeIndex = instanceInfo.lastUpgradeIndex
						newFeedbacks.push(feedback)
					}
				}
				control.condition = newFeedbacks
			}

			const allActions = []
			if (control.action_sets) {
				for (const [setId, action_set] of Object.entries(control.action_sets)) {
					const newActions = []
					for (const action of action_set) {
						const instanceInfo = instanceIdMap[action?.instance]
						if (action && instanceInfo) {
							action.instance = instanceInfo.id
							action.upgradeIndex = instanceInfo.lastUpgradeIndex
							newActions.push(action)
						}
					}
					control.action_sets[setId] = newActions
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
				control.condition || [],
				false
			)
		} else {
			if (control.feedbacks) {
				const newFeedbacks = []
				for (const feedback of control.feedbacks) {
					const instanceInfo = instanceIdMap[feedback?.instance_id]
					if (feedback && instanceInfo) {
						feedback.instance_id = instanceInfo.id
						feedback.upgradeIndex = instanceInfo.lastUpgradeIndex
						newFeedbacks.push(feedback)
					}
				}
				control.feedbacks = newFeedbacks
			}

			const allActions = []
			if (control.steps) {
				for (const step of Object.values(control.steps)) {
					for (const [setId, action_set] of Object.entries(step.action_sets)) {
						const newActions = []
						for (const action of action_set) {
							const instanceInfo = instanceIdMap[action?.instance]
							if (action && instanceInfo) {
								action.instance = instanceInfo.id
								action.upgradeIndex = instanceInfo.lastUpgradeIndex
								newActions.push(action)
							}
						}
						step.action_sets[setId] = newActions
						allActions.push(...newActions)
					}
				}
			}

			this.fixupControlReferences(
				{
					instanceLabels: instanceLabelRemap,
					instanceIds: instanceIdRemap,
				},
				control.style,
				allActions,
				control.feedbacks || [],
				false
			)
		}

		return control
	}

	/**
	 * Visit any references within the given control
	 * @param {object} visitor Visitor to be used
	 * @param {object | undefined} style Style object of the control (if any)
	 * @param {Array<object>} actions Array of actions belonging to the control
	 * @param {Array<object>} feedbacks Array of feedbacks belonging to the control
	 */
	visitControlReferences(visitor, style, actions, feedbacks) {
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
	}

	/**
	 * Fixup any references within the given control
	 * @param {object} updateMaps Description of instance ids and labels to remap
	 * @param {object | undefined} style Style object of the control (if any)
	 * @param {Array<object>} actions Array of actions belonging to the control
	 * @param {Array<object>} feedbacks Array of feedbacks belonging to the control
	 * @param {boolean} recheckChangedFeedbacks Whether to recheck the feedbacks that were modified
	 * @returns {boolean} Whether any changes were made
	 */
	fixupControlReferences(updateMaps, style, actions, feedbacks, recheckChangedFeedbacks) {
		const visitor = new VisitorReferencesUpdater(updateMaps.instanceLabels, updateMaps.instanceIds)

		this.visitControlReferences(visitor, style, actions, feedbacks)

		// Trigger the feedbacks to be rechecked, this will cause a redraw if needed
		if (recheckChangedFeedbacks && visitor.changedFeedbackIds.size > 0) {
			this.internalModule.checkFeedbacksById(...visitor.changedFeedbackIds)
		}

		return visitor.changed
	}
}

export default DataImportExport
