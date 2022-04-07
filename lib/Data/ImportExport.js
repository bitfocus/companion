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

const FILE_VERSION = 2

import os from 'os'
import { upgradeImport } from '../Data/Upgrade.js'
import { cloneDeep } from 'lodash-es'
import { getTimestamp, sendResult } from '../Resources/Util.js'
import CoreBase from '../Core/Base.js'
import Registry from '../Registry.js'

class DataImportExport extends CoreBase {
	constructor(registry) {
		super(registry, 'import/export', 'lib/Data/ImportExport')

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
				if (instance_id && this.instanceData[instance_id]) {
					exp.instances[instance_id] = this.instanceData[instance_id]
				}
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
				let exp = {
					version: FILE_VERSION,
					type: 'page',
				}

				exp.config = this.cleanPage(cloneDeep(this.config[page]))
				exp.instances = {}

				exp.action_sets = this.bank_action_sets[page]
				exp.feedbacks = this.feedbacks[page]

				exp.page = this.page.getPage(page, true)

				let instance_ids = new Set()

				for (const bank of Object.values(exp.action_sets)) {
					if (bank) {
						for (const action_set of Object.values(bank)) {
							for (const action of action_set) {
								instance_ids.add(action.instance)
							}
						}
					}
				}

				for (const bank of Object.values(exp.feedbacks)) {
					if (bank) {
						for (const feedback of bank) {
							instance_ids.add(feedback.instance_id)
						}
					}
				}

				for (const instance_id of instance_ids) {
					if (instance_id && this.instanceData[instance_id]) {
						exp.instances[instance_id] = this.instanceData[instance_id]
					}
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
			let exp = {
				version: FILE_VERSION,
				type: 'full',
			}

			exp.config = this.cleanPages(cloneDeep(this.config))
			exp.instances = {}

			exp.action_sets = this.bank_action_sets

			exp.page = this.page.getAll(true)

			exp.instances = this.db.getKey('instance')

			exp.custom_variables = this.instance.variable.custom.getDefinitions()

			exp.feedbacks = this.feedbacks

			res.writeHeader(200, {
				'Content-Type': 'application/json',
				'Content-Disposition':
					'attachment; filename="' + os.hostname() + '_full-config' + '_' + getTimestamp() + '.companionconfig"',
			})
			res.end(JSON.stringify(exp))
		})

		this.registry.api_router.get('/log_export', (req, res, next) => {
			let logs = this.registry.log.getAll()

			res.writeHeader(200, {
				'Content-Type': 'text/csv',
				'Content-Disposition':
					'attachment; filename="' + os.hostname() + '_companion_log' + '_' + getTimestamp() + '.csv"',
			})

			let out = `"Date","Module","Type","Log"\r\n`

			for (let id in logs) {
				let log = logs[id]
				out += `${new Date(log[0]).toISOString()},"${log[1]}","${log[2]}","${log[3]}"\r\n`
			}

			res.end(out)
		})
	}

	/**
	 * Setup a new socket client's events
	 * @param {SocketIO} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		client.on('loadsave_import_config', (data, answer) => {
			let object
			try {
				object = JSON.parse(data)
			} catch (e) {
				sendResult(client, answer, 'loadsave_import_config:result', 'File is corrupted or unknown format')
				return
			}

			if (object.version > FILE_VERSION) {
				sendResult(
					client,
					answer,
					'loadsave_import_config:result',
					'File was saved with a newer unsupported version of Companion'
				)
				return
			}

			if (object.type == 'bank') {
				sendResult(client, answer, 'loadsave_import_config:result', 'Cannot load single banks')
				return
			}

			object = upgradeImport(object)

			// rest is done from browser
			sendResult(client, answer, 'loadsave_import_config:result', null, object)
		})

		client.on('loadsave_reset_page_all', (page) => {
			for (let i = 1; i <= global.MAX_BUTTONS; ++i) {
				console.log('RESET BANK', page, i)
				this.bank.resetBank(page, i)
			}

			// make magical page buttons!
			this.bank.setBankStyle(page, 1, 'pageup')
			this.bank.setBankStyle(page, 9, 'pagenum')
			this.bank.setBankStyle(page, 17, 'pagedown')
			this.page.setPage(page, { name: 'PAGE' })

			client.emit('loadsave_reset_page:reset', null, 'ok')
		})

		client.on('loadsave_reset_page_nav', (page) => {
			// reset nav banks
			this.bank.resetBank(page, 1)
			this.bank.resetBank(page, 9)
			this.bank.resetBank(page, 17)

			// make magical page buttons!
			this.bank.setBankStyle(page, 1, 'pageup')
			this.bank.setBankStyle(page, 9, 'pagenum')
			this.bank.setBankStyle(page, 17, 'pagedown')

			this.page.setPage(page, { name: 'PAGE' })

			client.emit('loadsave_reset_page:reset', null, 'ok')
		})

		client.on('reset_all', (answer) => {
			for (let page = 1; page <= 99; ++page) {
				this.page.setPage(page, { name: 'PAGE' })

				for (let bank = 1; bank <= global.MAX_BUTTONS; ++bank) {
					this.bank.resetBank(page, bank)
				}

				// make magical page buttons!
				this.bank.setBankStyle(page, 1, 'pageup')
				this.bank.setBankStyle(page, 9, 'pagenum')
				this.bank.setBankStyle(page, 17, 'pagedown')
			}

			for (const key in this.instanceData) {
				if (key != 'bitfocus-companion' && this.instanceData[key].instance_type != 'bitfocus-companion') {
					this.instance.deleteInstance(key)
				}
			}

			// reset the scheduler/triggers
			this.triggers.reset()
			this.instance.variable.custom.reset()

			sendResult(client, answer, 'reset_all:result', null, 'ok')
		})

		client.on('loadsave_import_full', (data, answer) => {
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

			for (const key in this.instanceData) {
				if (key != 'bitfocus-companion' && this.instanceData[key].instance_type != 'bitfocus-companion') {
					this.instance.deleteInstance(key)
				}
			}

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

			this.instance.variable.custom.replaceDefinitions(data.custom_variables || {})

			for (let page = 1; page <= 99; ++page) {
				if (data.page !== undefined && data.page[page] !== undefined) {
					this.page.setPage(page, data.page[page], false)
				} else {
					this.page.setPage(page, { name: 'PAGE' }, false)
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

			this.bank.doSaveAll()

			sendResult(client, answer, 'loadsave_import_full:result', null, 'ok')
		})

		client.on('loadsave_import_page', (topage, frompage, data) => {
			if (data.type == 'full') {
				data.page = data.page[frompage]
				data.config = data.config[frompage]
				// action sets get combined below
				data.actions = data.actions === undefined ? {} : data.actions[frompage]
				data.release_actions = data.release_actions === undefined ? {} : data.release_actions[frompage]
				data.feedbacks = data.feedbacks === undefined ? {} : data.feedbacks[frompage]
				data.action_sets = data.action_sets === undefined ? {} : data.action_sets[frompage]
			}

			if (!data.action_sets) data.action_sets = {}

			// These are no longer needed
			delete data.actions
			delete data.release_actions

			if (data.page !== undefined) {
				this.page.setPage(topage, data.page)
			} else {
				this.page.setPage(topage, { name: 'PAGE' })
			}

			for (let i = 1; i <= global.MAX_BUTTONS; ++i) {
				this.bank.resetBank(topage, i, true, false)
			}

			this.bank.doSaveAll()

			if (!data.instances['bitfocus-companion']) {
				const idx = data.orig_version > 1 ? 2 : -1 // This is a hack. After this version it is tracked correctly.
				// We put it to 2 as its the 'safest' value to not break recent exports, at the cost of older ones (rather than the other way around)
				// But if data.orig_version is 1, then we know the snapshot needs to run all the scripts

				data.instances['bitfocus-companion'] = {
					import_to: 'bitfocus-companion',
					label: 'internal',
					id: 'bitfocus-companion',
					instance_type: 'bitfocus-companion',
					_configIdx: idx,
				}
			} else {
				data.instances['bitfocus-companion'].import_to = 'bitfocus-companion'
			}

			for (const key in data.instances) {
				const type = this.instance.verifyInstanceTypeIsCurrent(data.instances[key].instance_type)

				let instance_created = false
				let instance_id = key == 'bitfocus-companion' ? 'bitfocus-companion' : data.instances[key].import_to
				if (key != 'bitfocus-companion' && instance_id == 'new') {
					let product = data.instances[key].product
					const id = this.instance.addInstance({ type, product }, true)
					if (id) {
						const config = this.instanceData[id]
						instance_id = id
						instance_created = true

						for (const i in data.instances[key]) {
							if (i != 'label') {
								config[i] = data.instances[key][i]
							}
						}

						this.instance.setInstanceConfig(id, config)
					}
				}

				// Ensure the target instance exists
				if (this.instanceData[instance_id]) {
					for (const bank in data.config) {
						data.config[bank].text = this.instance.variable.renameVariablesInString(
							data.config[bank].text,
							data.instances[key].label,
							this.instanceData[instance_id].label
						)
					}
				}

				let instance_actions = []

				for (let bank in data.action_sets) {
					for (let set in data.action_sets[bank]) {
						if (!this.instanceData[instance_id]) {
							// filter out actions from the missing instance
							data.actions[bank][set] = data.actions[bank].filter((a) => a.instance != key)
						} else {
							for (let i = 0; i < data.action_sets[bank][set].length; ++i) {
								let act = data.action_sets[bank][set][i]

								if (act.instance == key) {
									act.instance = instance_id
									act.label = act.instance + ':' + act.action
									instance_actions.push(act)
								}
							}
						}
					}
				}

				let instance_feedbacks = []
				for (const bank in data.feedbacks) {
					if (!this.instanceData[instance_id]) {
						// filter out feedbacks from the missing instance
						data.feedbacks[bank] = data.feedbacks[bank].filter((a) => a.instance_id != key)
					} else {
						for (let i = 0; i < data.feedbacks[bank].length; ++i) {
							let act = data.feedbacks[bank][i]

							if (act.instance_id == key) {
								act.instance_id = instance_id
								instance_feedbacks.push(act)
							}
						}
					}
				}

				if (this.instanceData[instance_id]) {
					// run upgrade-scripts for all the imported things
					this.system.emit(
						'instance_upgrade_imported',
						instance_id,
						instance_created,
						type,
						data.instances[key],
						instance_actions,
						instance_feedbacks
					)

					if (instance_created) {
						// now the module can be enabled
						this.instance.enableDisableInstance(instance_id, true)
					}
				}
			}

			for (const bank in data.config) {
				let obj = {}
				obj.config = data.config !== undefined ? data.config[bank] : {}
				obj.action_sets = data.action_sets !== undefined ? data.action_sets[bank] : {}
				obj.feedbacks = data.feedbacks !== undefined ? data.feedbacks[bank] : []

				this.bank.importBank(topage, bank, obj, true, false)
			}

			this.bank.doSaveAll()
		})
	}

	loadData() {
		this.config = this.db.getKey('bank')

		this.instanceData = this.db.getKey('instance')

		this.bank_action_sets = this.bank.action.getAll()

		this.feedbacks = this.bank.feedback.getAll()
	}

	cleanPages(pages) {
		for (let i = 1; i <= 99; ++i) {
			if (pages[i] === undefined) {
				pages[i] = {}
			}

			this.cleanPage(pages[i])
		}
		return pages
	}

	cleanPage(page) {
		for (let i = 1; i <= global.MAX_BUTTONS; ++i) {
			if (page[i] === undefined) {
				page[i] = {}
			}
		}
		return page
	}
}

export default DataImportExport
