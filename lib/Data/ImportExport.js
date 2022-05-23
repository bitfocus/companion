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
import { CreateBankControlId, getTimestamp } from '../Resources/Util.js'
import CoreBase from '../Core/Base.js'
import Registry from '../Registry.js'

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

				if (trigger.type === 'feedback') {
					if (Array.isArray(trigger.config)) {
						for (const fb of trigger.config) {
							instance_ids.add(fb.instance_id)
						}
					} else if (trigger.config && trigger.config.instance_id) {
						instance_ids.add(trigger.config.instance_id)
					}
				}
			}

			for (const instance_id of instance_ids) {
				exp.instances[instance_id] = this.instance.exportInstance(instance_id) || {}
			}

			return exp
		}

		this.registry.api_router.get('/trigger_export_all', (req, res) => {
			const data = this.triggers.exportAll()
			const exp = generate_export_for_triggers(data)

			res.writeHeader(200, {
				'Content-Type': 'application/json',
				'Content-Disposition':
					'attachment; filename="' + os.hostname() + '_trigger_list_' + getTimestamp() + '.companionconfig"',
			})
			res.end(JSON.stringify(exp))
		})

		this.registry.api_router.get('/trigger_export/:id', (req, res, next) => {
			const id = Number(req.params.id)
			const data = this.triggers.exportSingle(id)
			if (data) {
				const exp = generate_export_for_triggers([data])

				res.writeHeader(200, {
					'Content-Type': 'application/json',
					'Content-Disposition':
						'attachment; filename="' +
						os.hostname() +
						'_trigger_' +
						data.title.toLowerCase().replace(/\W/, '') +
						'_' +
						getTimestamp() +
						'.companionconfig"',
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
				}

				// Find all the instances referenced by this page
				const instance_ids = new Set()
				for (const control of Object.values(exp.controls)) {
					// Future: this should be done inside of the control classes, as they could use a non-standard structure
					for (const feedback of control.feedbacks || []) {
						instance_ids.add(feedback.instance_id)
					}

					for (const action_set of Object.values(control.action_sets || {})) {
						for (const action of action_set) {
							instance_ids.add(action.instance)
						}
					}
				}

				for (const instance_id of instance_ids) {
					exp.instances[instance_id] = this.instance.exportInstance(instance_id) || {}
				}

				res.writeHeader(200, {
					'Content-Type': 'application/json',
					'Content-Disposition':
						'attachment; filename="' + os.hostname() + '_page ' + page + '_' + getTimestamp() + '.companionconfig"',
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

			res.writeHeader(200, {
				'Content-Type': 'application/json',
				'Content-Disposition':
					'attachment; filename="' + os.hostname() + '_full-config' + '_' + getTimestamp() + '.companionconfig"',
			})
			res.end(JSON.stringify(exp))
		})

		this.registry.api_router.get('/log_export', (req, res, next) => {
			const logs = this.registry.log.getAllLines()

			res.writeHeader(200, {
				'Content-Type': 'text/csv',
				'Content-Disposition':
					'attachment; filename="' + os.hostname() + '_companion_log' + '_' + getTimestamp() + '.csv"',
			})

			let out = `"Date","Module","Type","Log"\r\n`

			for (const line of logs) {
				out += `${new Date(line[0]).toISOString()},"${line[1]}","${line[2]}","${line[3]}"\r\n`
			}

			res.end(out)
		})

		// TODO - reimplement
		// this.registry.api_router.get('/support_export', (req, res, next) => {
		// 	// Export support zip
		// 	const archive = archiver('zip', { zlib: { level: 9 } })

		// 	archive.on('error', function (err) {
		// 		console.log(err)
		// 	})

		// 	//on stream closed we can end the request
		// 	archive.on('end', function () {
		// 		debug('Support export wrote %d bytes', archive.pointer())
		// 	})

		// 	//set the archive name
		// 	res.attachment(os.hostname() + '_companion-config_' + getTimestamp() + '.zip')

		// 	//this is the streaming magic
		// 	archive.pipe(res)

		// 	self.system.emit('configdir_get', function (_cfgDir) {
		// 		archive.glob(
		// 			'*',
		// 			{
		// 				cwd: _cfgDir,
		// 				nodir: true,
		// 			},
		// 			{}
		// 		)
		// 	})

		// 	self.system.emit('log_get', function (logs) {
		// 		let out = `"Date","Module","Type","Log"\r\n`

		// 		for (let id in logs) {
		// 			let log = logs[id]
		// 			out += `${new Date(log[0]).toISOString()},"${log[1]}","${log[2]}","${log[3]}"\r\n`
		// 		}

		// 		archive.append(out, { name: 'log.csv' })
		// 	})

		// 	self.system.emit('db_all', function (_db) {
		// 		try {
		// 			let out = JSON.stringify(_db)
		// 			archive.append(out, { name: 'db.ram' })
		// 		} catch (e) {
		// 			debug(e)
		// 		}
		// 	})

		// 	try {
		// 		self.system.emit('update_get', function (update) {
		// 			let out = JSON.stringify(update.payload)
		// 			archive.append(out, { name: 'user.json' })
		// 		})
		// 	} catch (e) {
		// 		debug(e)
		// 	}

		// 	archive.finalize()
		// })
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

			// TODO - implement the latest batch of upgrading
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
				clientObject.instances[instanceId] = {
					instance_type: this.instance.verifyInstanceTypeIsCurrent(instance.instance_type),
					label: instance.label,
				}
			}

			if (object.type === 'page') {
				clientObject.page = object.page
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
					...controlObj.config,
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
			for (let i = 1; i <= global.MAX_BUTTONS; ++i) {
				this.logger.silly(`RESET BANK ${page}.${i}`)

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

		client.onPromise('loadsave:reset-full', async () => {
			for (let page = 1; page <= 99; ++page) {
				this.page.setPage(page, null)

				for (let bank = 1; bank <= global.MAX_BUTTONS; ++bank) {
					const newStyle = default_nav_buttons[bank]
					this.controls.resetControl(CreateBankControlId(page, bank), newStyle)
				}
			}

			await this.instance.deleteAllInstances()

			// reset the scheduler/triggers
			this.triggers.reset()
			this.instance.variable.custom.reset()

			return 'ok'
		})

		client.on('loadsave_import_full', async (data, answer) => {
			// Support for reading erroneous exports from pre-release
			if (data.bank_release_actions !== undefined) {
				data.release_actions = data.bank_release_actions
				delete data.bank_release_actions
			}

			/* Reset is done in `importBank` later
			for (let page = 1; page <= 99; ++page) {
				for (let bank = 1; bank <= global.MAX_BUTTONS; ++bank) {
					this.bank.resetBank(page, bank, false, false)
				}
			}

			this.bank.doSaveAll()
			*/

			await this.instance.deleteAllInstances()

			this.instance.variable.custom.replaceDefinitions(data.custom_variables || {})

			for (let page = 1; page <= 99; ++page) {
				if (data.page !== undefined && data.page[page] !== undefined) {
					this.page.setPage(page, data.page[page], false)
				} else {
					this.page.setPage(page, null, false)
				}

				for (let bank = 1; bank <= global.MAX_BUTTONS; ++bank) {
					let obj = {}

					obj.config = data.config[page][bank]

					if (data.action_sets && data.action_sets[page] && data.action_sets[page][bank]) {
						obj.action_sets = data.action_sets[page][bank]
					} else {
						obj.action_sets = {}
					}

					if (
						data.feedbacks !== undefined &&
						data.feedbacks[page] !== undefined &&
						data.feedbacks[page][bank] !== undefined
					) {
						obj.feedbacks = data.feedbacks[page][bank]
					} else {
						obj.feedbacks = []
					}

					this.bank.importBank(page, bank, obj, true, false)
				}
			}

			// Finally import the instances. This needs to be last to let upgrade-scripts run after all data is loaded
			for (const key in data.instances) {
				if (key == 'bitfocus-companion' || data.instances[key].instance_type == 'bitfocus-companion') {
					delete data.instances[key]
					continue
				}

				this.instanceData[key] = data.instances[key]
				if (data.instances[key].enabled) {
					this.instance.activate_module(key)
				}
			}

			this.bank.doSaveAll()

			answer(null, 'ok')
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

	#importInstances(instances, instanceRemapping) {
		const instanceIdMap = {}

		console.log(instanceRemapping, instances)

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
					feedback.lastUpgradeIndex = instanceInfo.lastUpgradeIndex
					newFeedbacks.push(feedback)
				}
			}
			control.feedbacks = newFeedbacks
		}
		if (control.action_sets) {
			for (const [setId, action_set] of Object.entries(control.action_sets)) {
				const newActions = []
				for (const action of action_set) {
					const instanceInfo = instanceIdMap[action?.instance]
					if (action && instanceInfo) {
						action.instance = instanceInfo.id
						action.lastUpgradeIndex = instanceInfo.lastUpgradeIndex
						newActions.push(action)
					}
				}
				control.action_sets[setId] = newActions
			}
		}

		return control
	}
}

export default DataImportExport
