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
import { getTimestamp } from '../Resources/Util.js'
import { CreateBankControlId, CreateTriggerControlId } from '../Shared/ControlId.js'
import CoreBase from '../Core/Base.js'
import Registry from '../Registry.js'
import archiver from 'archiver'

/**
 * Default buttons on fresh pages
 */
const default_nav_buttons = {
	1: 'pageup',
	9: 'pagenum',
	17: 'pagedown',
}

class DataImportExport extends CoreBase {
	constructor(registry) {
		super(registry, 'import/export', 'Data/ImportExport')

		const generate_export_for_triggers = (triggers) => {
			const exp = {
				type: 'trigger_list',
				version: FILE_VERSION,
				triggers: triggers,
				instances: {},
			}

			const instance_ids = new Set()

			for (const trigger of triggers) {
				for (const action of trigger.actions || []) {
					instance_ids.add(action.instance)
				}

				for (const fb of trigger.condition) {
					instance_ids.add(fb.instance_id)
				}
			}

			for (const instance_id of instance_ids) {
				exp.instances[instance_id] = this.instance.exportInstance(instance_id) || {}
			}

			return exp
		}

		this.registry.api_router.get('/trigger_export_all', (req, res) => {
			const triggerControls = Object.values(this.controls.getAllControls()).filter((c) => c.type === 'trigger')
			const data = triggerControls.map((control) => control.toJSON(false))
			const exp = generate_export_for_triggers(data)

			const filename = encodeURI(`${os.hostname()}_trigger_list_${getTimestamp()}.companionconfig`)

			res.writeHeader(200, {
				'Content-Type': 'application/json',
				'Content-Disposition': `attachment; filename="${filename}"`,
			})
			res.end(JSON.stringify(exp))
		})

		this.registry.api_router.get('/trigger_export/:id', (req, res, next) => {
			const controlId = CreateTriggerControlId(req.params.id)
			const control = this.controls.getControl(controlId)
			if (control) {
				const data = control.toJSON(false)
				const exp = generate_export_for_triggers([data])

				const filename = encodeURI(
					`${os.hostname()}_trigger_${data.options.name
						.toLowerCase()
						.replace(/\W/, '')}_${getTimestamp()}.companionconfig`
				)

				res.writeHeader(200, {
					'Content-Type': 'application/json',
					'Content-Disposition': `attachment; filename="${filename}"`,
				})
				res.end(JSON.stringify(exp))
			} else {
				next()
			}
		})

		this.registry.api_router.get('/page_export/:page', (req, res, next) => {
			const page = Number(req.params.page)
			if (isNaN(page)) {
				next()
			} else {
				// Export file protocol version
				const exp = {
					version: FILE_VERSION,
					type: 'page',
					controls: this.controls.exportPage(page, false),
					page: this.page.getPage(page, false),
					instances: {},
					oldPageNumber: page,
				}

				// Find all the instances referenced by this page
				const instance_ids = new Set()
				for (const control of Object.values(exp.controls)) {
					// Future: this should be done inside of the control classes, as they could use a non-standard structure
					for (const feedback of control.feedbacks || []) {
						instance_ids.add(feedback.instance_id)
					}

					for (const step of Object.entries(control.steps || {})) {
						for (const action_set of Object.values(step.action_sets || {})) {
							for (const action of action_set) {
								instance_ids.add(action.instance)
							}
						}
					}
				}

				for (const instance_id of instance_ids) {
					exp.instances[instance_id] = this.instance.exportInstance(instance_id) || {}
				}

				const filename = encodeURI(`${os.hostname()}_page${page}_${getTimestamp()}.companionconfig`)

				res.writeHeader(200, {
					'Content-Type': 'application/json',
					'Content-Disposition': `attachment; filename="${filename}"`,
				})
				res.end(JSON.stringify(exp))
			}
		})

		this.registry.api_router.get('/full_export', (req, res, next) => {
			// Export file protocol version
			const exp = {
				version: FILE_VERSION,
				type: 'full',
				controls: this.controls.exportAll(false),
				pages: this.page.getAll(false),
				instances: this.instance.exportAll(false),
				custom_variables: this.instance.variable.custom.getDefinitions(),
			}

			const filename = encodeURI(`${os.hostname()}_full-config_${getTimestamp()}.companionconfig`)

			res.writeHeader(200, {
				'Content-Type': 'application/json',
				'Content-Disposition': `attachment; filename="${filename}"`,
			})
			res.end(JSON.stringify(exp))
		})

		this.registry.api_router.get('/log_export', (req, res, next) => {
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

		this.registry.api_router.get('/support_export', (req, res, next) => {
			// Export support zip
			const archive = archiver('zip', { zlib: { level: 9 } })

			archive.on('error', (err) => {
				console.log(err)
			})

			//on stream closed we can end the request
			archive.on('end', () => {
				this.logger.debug('Support export wrote %d bytes', archive.pointer())
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
				},
				{}
			)

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

	/**
	 * Setup a new socket client's events
	 * @param {SocketIO} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		client.onPromise('loadsave:abort', () => {
			if (client.pendingImport) {
				// TODO - stop timer
				delete client.pendingImport
			}

			return true
		})
		client.onPromise('loadsave:prepare-import', (dataStr) => {
			let object
			try {
				object = JSON.parse(dataStr)
			} catch (e) {
				return ['File is corrupted or unknown format']
			}

			if (object.version > FILE_VERSION) {
				return ['File was saved with a newer unsupported version of Companion']
			}

			if (object.type !== 'full' && object.type !== 'page') {
				return ['Unknown import type']
			}

			object = upgradeImport(object)

			// Store the object on the client
			client.pendingImport = {
				object,
				timeout: null, // TODO
			}

			// Build a minimal object to send back to the client
			const clientObject = {
				type: object.type,
				instances: {},
			}

			for (const [instanceId, instance] of Object.entries(object.instances || {})) {
				if (instanceId === 'internal' || instanceId === 'bitfocus-companion') continue

				clientObject.instances[instanceId] = {
					instance_type: this.instance.verifyInstanceTypeIsCurrent(instance.instance_type),
					label: instance.label,
				}
			}

			if (object.type === 'page') {
				clientObject.page = object.page
				clientObject.oldPageNumber = object.oldPageNumber || 1
			} else {
				clientObject.pages = object.pages
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

		client.onPromise('loadsave:abort-import', () => {
			// Clear the pending object
			delete client.pendingImport
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

		client.onPromise('loadsave:reset-full', this.#resetFull.bind(this))

		client.onPromise('loadsave:import-full', async () => {
			const data = client.pendingImport?.object
			if (!data) throw new Error('No in-progress import object')

			if (data.type !== 'full') throw new Error('Invalid import object')

			// Destroy old stuff
			await this.#resetFull(true)

			// import custom variables
			this.instance.variable.custom.replaceDefinitions(data.custom_variables || {})

			// Import instances
			const instanceIdMap = this.#importInstances(data.instances, {})

			// Import page names
			for (let page = 1; page <= 99; page++) {
				this.page.setPage(page, data.pages[page])
			}

			// Import controls
			for (const [controlId, control] of Object.entries(data.controls)) {
				const fixedControlObj = this.#fixupControl(cloneDeep(control), instanceIdMap)
				this.controls.importControl(controlId, fixedControlObj)
			}
		})

		client.onPromise('loadsave:import-page', (topage, frompage, instanceRemapping) => {
			const data = client.pendingImport?.object
			if (!data) throw new Error('No in-progress import object')

			if (topage <= 0 || topage > 99) throw new Error('Invalid target page')

			if (data.type === 'full') {
				this.page.setPage(topage, data.pages?.[frompage])

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
					const fixedControlObj = this.#fixupControl(oldControl, instanceIdMap)
					this.controls.importControl(toControlId, fixedControlObj)
				} else {
					// Clear the target
					this.controls.resetControl(toControlId)
				}
			}

			// Report the used remap to the ui
			const instanceRemap2 = {}
			for (const [id, obj] of Object.entries(instanceIdMap)) {
				instanceRemap2[id] = obj.id
			}

			return instanceRemap2
		})
	}

	loadData() {
		this.instanceData = this.db.getKey('instance')
	}

	async #resetFull(skipNavButtons = false) {
		// Discard all controls
		this.controls.resetAllControls()

		// Setup default pages
		for (let page = 1; page <= 99; ++page) {
			this.page.setPage(page, null)

			if (!skipNavButtons) {
				for (const [bank, newStyle] of Object.entries(default_nav_buttons)) {
					this.controls.resetControl(CreateBankControlId(page, bank), newStyle)
				}
			}
		}

		await this.instance.deleteAllInstances()

		this.instance.variable.custom.reset()

		return 'ok'
	}

	#importInstances(instances, instanceRemapping) {
		const instanceIdMap = {}

		for (const [oldId, obj] of Object.entries(instances)) {
			const remapId = instanceRemapping[oldId]
			const remapConfig = remapId ? this.instance.getInstanceConfig(remapId) : undefined
			if (remapId && remapConfig?.label) {
				// Reuse an existing instance
				instanceIdMap[oldId] = {
					id: remapId,
					label: remapConfig.label,
					lastUpgradeIndex: obj.lastUpgradeIndex,
					oldLabel: obj.label,
				}
			} else {
				// Create a new instance
				const instance_type = this.instance.verifyInstanceTypeIsCurrent(obj.instance_type)
				const newId = this.instance.addInstance({ type: instance_type }, true)
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

	#fixupControl(control, instanceIdMap) {
		// Future: this does not feel durable

		// Rename any variables in the button label
		if (control.config?.text) {
			// TODO - what happens if two ids are swapped?
			for (const info of Object.values(instanceIdMap)) {
				if (info.label !== info.oldLabel) {
					control.config.text = this.instance.variable.renameVariablesInString(
						control.config.text,
						info.oldLabel,
						info.label
					)
				}
			}
		}

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
				}
			}
		}

		return control
	}
}

export default DataImportExport
