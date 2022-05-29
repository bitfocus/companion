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
			for (let bank = 1; bank < global.MAX_BUTTONS; bank++) {
				const bankConfig = oldConfig[page]?.[bank]
				if (bankConfig && bankConfig.style) {
					const bankActions = oldActions[page]?.[bank]
					const bankFeedbacks = oldFeedbacks[page]?.[bank]

					const bankConfig2 = { ...bankConfig }
					delete bankConfig2.style

					newControls[CreateBankControlId(page, bank)] = {
						type: bankConfig.style,
						config: bankConfig2,
						action_sets: bankActions || {},
						feedbacks: bankFeedbacks || [],
					}
				}
			}
		}

		db.deleteKey('bank')
		db.deleteKey('feedbacks')
		db.deleteKey('bank_action_sets')
		db.setKey('controls', newControls)
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
			for (let bank = 1; bank < global.MAX_BUTTONS; bank++) {
				const config = obj.config[page]?.[bank]
				if (config?.style) {
					upgradeBankStyle(config)

					newObj.controls[CreateBankControlId(page, bank)] = {
						type: config.style,
						config: config,
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

		for (let bank = 1; bank < global.MAX_BUTTONS; bank++) {
			const config = obj.config?.[bank]
			if (config?.style) {
				upgradeBankStyle(config)

				newObj.controls[CreateBankControlId(newObj.oldPageNumber, bank)] = {
					type: config.style,
					config: config,
					action_sets: combineActionsToSets(config, obj.actions?.[bank], obj.release_actions?.[bank]),
					feedbacks: obj.feedbacks?.[bank] || [],
				}
			}
		}

		return newObj
	}
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
