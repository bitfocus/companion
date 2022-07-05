import { CreateBankControlId } from '../../Resources/Util.js'

function convertInstanceToV3(obj) {
	if (obj.config === undefined) {
		const newConfig = { ...obj }
		delete newConfig.instance_type
		delete newConfig.label
		delete newConfig.enabled
		delete newConfig._configIdx

		return {
			instance_type: obj.instance_type,
			label: obj.label,
			enabled: obj.enabled,
			config: newConfig,
			lastUpgradeIndex: obj._configIdx,
		}
	} else {
		return obj
	}
}

/** do the database upgrades to convert from the v1 to the v2 format */
function convertDatabaseToV3(db) {
	if (db.hasKey('instance')) {
		const instances = db.getKey('instance')
		// Delete the old internal module, as it is truely internal now
		delete instances['bitfocus-companion']

		for (const [id, obj] of Object.entries(instances)) {
			instances[id] = convertInstanceToV3(obj)
		}

		db.setKey('instance', instances)
	}

	if (!db.hasKey('controls')) {
		if (!db.hasKey('bank_action_sets')) {
			const oldBankConfig = db.getKey('bank', {})
			const oldActions = db.getKey('bank_actions', {})
			const oldReleaseActions = db.getKey('bank_release_actions', {})

			const newActionSets = {}

			for (let page = 1; page <= 99; page++) {
				const obj = {
					config: oldBankConfig[page],
					actions: oldActions[page],
					release_actions: oldReleaseActions[page],
				}

				const res = convertPageToV3(obj)

				oldBankConfig[page] = res.config
				newActionSets[page] = res.action_sets
			}

			// Update the db
			db.deleteKey('bank_actions')
			db.deleteKey('bank_release_actions')
			db.setKey('bank_action_sets', newActionSets)
		}

		const oldConfig = db.getKey('bank', {})
		const oldActions = db.getKey('bank_action_sets', {})
		const oldFeedbacks = db.getKey('feedbacks', {})

		const newControls = {}
		for (let page = 1; page <= 99; page++) {
			for (let bank = 1; bank <= global.MAX_BUTTONS; bank++) {
				const bankConfig = oldConfig[page]?.[bank]
				if (bankConfig && bankConfig.style) {
					const bankActions = oldActions[page]?.[bank]
					const bankFeedbacks = oldFeedbacks[page]?.[bank]

					newControls[CreateBankControlId(page, bank)] = fixUpControl({
						...splitBankConfigToStyleAndOptions(bankConfig),
						action_sets: bankActions || {},
						feedbacks: bankFeedbacks || [],
					})
				}
			}
		}

		db.deleteKey('bank')
		db.deleteKey('feedbacks')
		db.deleteKey('bank_action_sets')
		db.setKey('controls', newControls)
	}

	if (db.hasKey('scheduler')) {
		let scheduler = db.getKey('scheduler')

		if (Array.isArray(scheduler)) {
			// Convert into an object
			const obj = {}
			for (const conf of scheduler) {
				obj[conf.id] = conf
			}
			scheduler = obj
		}

		for (const entry of Object.values(scheduler)) {
			if (entry) {
				// Fix up instance ids for the internal
				if (Array.isArray(entry.actions)) {
					for (const action of entry.actions) {
						if (action.instance === 'bitfocus-companion') {
							action.instance = 'internal'
						}
					}
				}
				if (entry.type === 'feedback') {
					const config = Array.isArray(entry.config) ? entry.config : [entry.config]
					for (const feedback of config) {
						if (feedback.instance_id === 'bitfocus-companion') {
							feedback.instance_id = 'internal'
						}
					}
				}

				// Convert variable type to feedback type
				if (entry.type === 'variable') {
					entry.type = 'feedback'

					const newConfig = []
					const oldConfig = Array.isArray(entry.config) ? entry.config : [entry.config]
					for (let conf of oldConfig) {
						let check = conf.check
						if (check == 'lt') check = 'gt'
						else if (check == 'gt') check = 'lt'

						newConfig.push({
							id: nanoid(),
							type: 'variable_value',
							instance_id: 'internal',
							options: {
								variable: conf.key,
								op: check,
								value: conf.value,
							},
						})
					}
					entry.config = newConfig
				}

				// Convert button index to an action
				if (entry.button && !entry.actions) {
					const page = parseInt(entry.button)
					const bank = parseInt(entry.button.toString().replace(/(.*)\./, ''))
					entry.actions = [
						{
							id: nanoid(),
							instance: 'internal',
							action: 'button_pressrelease',
							options: {
								page: page,
								bank: bank,
							},
						},
					]

					delete entry.button
				}
			}
		}

		db.setKey('scheduler', scheduler)
	}
}

function convertPageToV3(oldObj) {
	// find the old data
	const oldPageConfig = oldObj.config || {}
	const oldPageActions = oldObj.actions || {}
	const oldPageReleaseActions = oldObj.release_actions || {}

	// create the new data
	const result = {
		config: {},
		action_sets: {},
	}

	// convert the data across
	for (let bank = 1; bank <= global.MAX_BUTTONS; ++bank) {
		const config = oldPageConfig[bank] || {}
		upgradeBankStyle(config)
		result.config[bank] = config

		result.action_sets[bank] = combineActionsToSets(config, oldPageActions[bank], oldPageReleaseActions[bank])
	}

	return result
}

function fixUpControl(control) {
	for (const set of Object.values(control.action_sets)) {
		for (const action of set) {
			if (action.instance === 'bitfocus-companion') {
				action.instance = 'internal'
			}
		}
	}

	for (const feedback of control.feedbacks) {
		if (feedback.instance_id === 'bitfocus-companion') {
			feedback.instance_id = 'internal'
		}
	}

	return control
}

function convertImportToSets(obj) {
	if (obj.type == 'full') {
		const newObj = {
			version: 3,
			orig_version: obj.orig_version || obj.version,
			type: 'full',
			instances: {},
			controls: {},
			pages: obj.page,
		}

		for (const [id, inst] of Object.entries(obj.instances)) {
			newObj.instances[id] = convertInstanceToV3(inst)
		}
		delete newObj.instances['bitfocus-companion']

		for (let page = 1; page <= 99; page++) {
			for (let bank = 1; bank <= global.MAX_BUTTONS; bank++) {
				const config = obj.config[page]?.[bank]
				if (config?.style) {
					upgradeBankStyle(config)

					newObj.controls[CreateBankControlId(page, bank)] = {
						...splitBankConfigToStyleAndOptions(config),
						action_sets: combineActionsToSets(config, obj.actions?.[page]?.[bank], obj.release_actions?.[page]?.[bank]),
						feedbacks: obj.feedbacks?.[page]?.[bank] || [],
					}
				}
			}
		}

		return newObj
	} else {
		// type == 'page'
		const newObj = {
			version: 3,
			orig_version: obj.orig_version || obj.version,
			type: 'page',
			instances: {},
			controls: {},
			page: obj.page,
			oldPageNumber: 1,
		}

		for (const [id, inst] of Object.entries(obj.instances)) {
			newObj.instances[id] = convertInstanceToV3(inst)
		}
		delete newObj.instances['bitfocus-companion']

		for (let bank = 1; bank <= global.MAX_BUTTONS; bank++) {
			const config = obj.config?.[bank]
			if (config?.style) {
				upgradeBankStyle(config)

				newObj.controls[CreateBankControlId(newObj.oldPageNumber, bank)] = {
					...splitBankConfigToStyleAndOptions(config),
					action_sets: combineActionsToSets(config, obj.actions?.[bank], obj.release_actions?.[bank]),
					feedbacks: obj.feedbacks?.[bank] || [],
				}
			}
		}

		return newObj
	}
}

function splitBankConfigToStyleAndOptions(config) {
	const style = {
		...config,
		showTopBar: config.show_top_bar,
	}
	delete style.relative_delay
	delete style.show_top_bar
	delete style.style

	const options = {
		relativeDelay: config.relative_delay,
	}

	return { style, options, type: config.style }
}

function upgradeBankStyle(config) {
	if (config && config.style == 'png') {
		config.style = config.latch ? 'step' : 'press'
	}
}

function combineActionsToSets(style, actions, release_actions) {
	const bank_action_sets = {}
	if (style.style == 'press') {
		bank_action_sets['down'] = actions || []
		bank_action_sets['up'] = release_actions || []
	} else if (style.style == 'step') {
		bank_action_sets[0] = actions || []
		bank_action_sets[1] = release_actions || []
	}
	return bank_action_sets
}

export default {
	upgradeStartup: convertDatabaseToV3,
	upgradeImport: convertImportToSets,
}
