import { LEGACY_MAX_BUTTONS } from '../../Util/Constants.js'

/**
 * do the database upgrades to convert from the v1 to the v2 format
 * @param {import('../Database.js').default} db
 * @param {import('winston').Logger} _logger
 * @returns {void}
 */
function convertDatabase15To32(db, _logger) {
	const oldBankConfig = db.getKey('bank', {})
	const oldActions = db.getKey('bank_actions', {})
	const oldReleaseActions = db.getKey('bank_release_actions', {})
	const oldFeedbacks = db.getKey('feedbacks', {})

	for (let page = 1; page <= 99; page++) {
		const obj = {
			config: oldBankConfig[page],
			actions: oldActions[page],
			release_actions: oldReleaseActions[page],
			feedbacks: oldFeedbacks[page],
		}

		const res = convertPage15To32(obj)

		oldBankConfig[page] = res.config
		oldActions[page] = res.actions
		oldReleaseActions[page] = res.release_actions
		oldFeedbacks[page] = res.feedbacks
	}
}

/**
 *
 * @param {*} oldObj
 * @returns
 */
function convertPage15To32(oldObj) {
	// find the old data
	const oldPageConfig = oldObj.config || {}
	const oldPageActions = oldObj.actions || {}
	const oldPageReleaseActions = oldObj.release_actions || {}
	const oldPageFeedbacks = oldObj.feedbacks || {}

	// create the new data
	/** @type {any} */
	const result = {
		config: {},
		actions: {},
		release_actions: {},
		feedbacks: {},
	}

	// ensure the new objects are well formed
	for (let bank = 1; bank <= LEGACY_MAX_BUTTONS; bank++) {
		result.config[bank] = {}
		result.actions[bank] = []
		result.release_actions[bank] = []
		result.feedbacks[bank] = []
	}

	// copy across the old buttons
	for (let oldBank = 1; oldBank <= 12; oldBank++) {
		const newBank = from12to32(oldBank)

		result.config[newBank] = oldPageConfig[oldBank]
		upgradeBankStyle(result.config[newBank])

		result.actions[newBank] = oldPageActions[oldBank]
		result.release_actions[newBank] = oldPageReleaseActions[oldBank]
		result.feedbacks[newBank] = oldPageFeedbacks[oldBank]
	}

	// Add navigation keys
	result.config[1] = { style: 'pageup' }
	result.config[9] = { style: 'pagenum' }
	result.config[17] = { style: 'pagedown' }

	return result
}

/**
 *
 * @param {*} obj
 * @returns
 */
function convertImport15To32(obj) {
	if (obj.type == 'full') {
		obj.version = 2

		if (!obj.actions) obj.actions = {}
		if (!obj.release_actions) {
			obj.release_actions = obj.bank_release_actions || {}
			delete obj.bank_release_actions
		}
		if (!obj.feedbacks) obj.feedbacks = {}

		for (const page in obj.page) {
			const tmpdata = {
				// type: 'page',
				// version: 1,
				// page: obj.page[page],
				config: obj.config[page],
				actions: obj.actions[page],
				release_actions: obj.release_actions[page],
				feedbacks: obj.feedbacks[page],
			}

			const newdata = convertPage15To32(tmpdata)

			// obj.page[page] = newdata.page
			obj.config[page] = newdata.config
			obj.actions[page] = newdata.actions
			obj.release_actions[page] = newdata.release_actions
			obj.feedbacks[page] = newdata.feedbacks
		}

		console.debug('convert_full_to_v2: done')
		return obj
	} else {
		// type == 'page'

		// Support for reading erroneous exports from pre-release
		if (obj.bank_release_actions && !obj.release_actions) {
			obj.release_actions = obj.bank_release_actions
			delete obj.bank_release_actions
		}

		const data = convertPage15To32(obj)

		data.orig_version = obj.version
		data.version = 2

		data.type = obj.type
		data.page = obj.page

		data.instances = obj.instances

		return data
	}
}

// function convertPresetStyle(obj) {
// 	if (obj) {
// 		upgradeBankStyle(obj.bank)
// 	}

// 	return obj
// }

/**
 *
 * @param {*} key
 * @returns
 */
function from12to32(key) {
	key = key - 1

	var rows = Math.floor(key / 4)
	var col = (key % 4) + 2
	var res = rows * 8 + col

	if (res >= 32) {
		console.debug('assert: old config had bigger pages than expected')
		return 31
	}
	return res
}

/**
 *
 * @param {*} config
 */
function upgradeBankStyle(config) {
	if (config && config.style) {
		if (config.style == 'bigtext') {
			config.size = 'large'
			config.style = 'png'
		} else if (config.style == 'smalltext') {
			config.size = 'small'
			config.style = 'png'
		} else if (config.style == 'text') {
			config.style = 'png'
		}
	}
}

export default {
	upgradeStartup: convertDatabase15To32,
	upgradeImport: convertImport15To32,
}
