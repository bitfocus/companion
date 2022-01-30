/** do the database upgrades to convert from the v1 to the v2 format */
function convertDatabaseToSets(db) {
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

			const res = convertPageToSets(obj)

			oldBankConfig[page] = res.config
			newActionSets[page] = res.action_sets
		}

		// Update the db
		db.deleteKey('bank_actions')
		db.deleteKey('bank_release_actions')
		db.setKey('bank_action_sets', newActionSets)
	}
}

function convertPageToSets(oldObj) {
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

function convertPresetToSets(obj) {
	if (obj && obj.bank) {
		upgradeBankStyle(obj.bank)

		if (!obj.action_sets) {
			obj.action_sets = combineActionsToSets(obj.bank, obj.actions, obj.release_actions)
		}
		delete obj.actions
		delete obj.release_actions
	}

	return obj
}

function convertImportToSets(obj) {
	if (obj.type == 'full') {
		obj.version = 3
		obj.action_sets = {}

		if (!obj.actions) obj.actions = {}
		if (!obj.release_actions) obj.release_actions = {}

		for (const page in obj.page) {
			const tmpdata = {
				config: obj.config[page],
				actions: obj.actions[page],
				release_actions: obj.release_actions[page],
			}

			const newdata = convertPageToSets(tmpdata)

			obj.config[page] = newdata.config
			obj.action_sets[page] = newdata.action_sets
		}

		delete obj.actions
		delete obj.release_actions
		return obj
	} else {
		// type == 'page'
		const data = {
			...obj,
			...convertPageToSets(obj),
		}

		delete data.actions
		delete data.release_actions

		data.orig_version = obj.version
		data.version = 3

		return data
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

module.exports = {
	startup: convertDatabaseToSets,
	preset: convertPresetToSets,
	import: convertImportToSets,
}
