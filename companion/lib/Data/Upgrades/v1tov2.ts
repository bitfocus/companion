import { LEGACY_MAX_BUTTONS, LEGACY_PAGE_COUNT } from '../../Resources/Constants.js'
import type { DataStoreBase } from '../StoreBase.js'
import type { Logger } from '../../Log/Controller.js'

/**
 * do the database upgrades to convert from the v1 to the v2 format
 */
function convertDatabase15To32(db: DataStoreBase<any>, _logger: Logger): void {
	const mainTable = db.defaultTableView

	const oldBankConfig = mainTable.getOrDefault('bank', {})
	const oldActions = mainTable.getOrDefault('bank_actions', {})
	const oldReleaseActions = mainTable.getOrDefault('bank_release_actions', {})
	const oldFeedbacks = mainTable.getOrDefault('feedbacks', {})

	for (let page = 1; page <= LEGACY_PAGE_COUNT; page++) {
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

	mainTable.set('bank', oldBankConfig)
	mainTable.set('bank_actions', oldActions)
	mainTable.set('bank_release_actions', oldReleaseActions)
	mainTable.set('feedbacks', oldFeedbacks)

	mainTable.set('page_config_version', 2)
}

function convertPage15To32(oldObj: any): any {
	// find the old data
	const oldPageConfig = oldObj.config || {}
	const oldPageActions = oldObj.actions || {}
	const oldPageReleaseActions = oldObj.release_actions || {}
	const oldPageFeedbacks = oldObj.feedbacks || {}

	// create the new data
	const result: any = {
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
		//result.feedbacks[bank] = []
	}

	// copy across the old buttons
	for (let oldBank = 1; oldBank <= 12; oldBank++) {
		const newBank = from12to32(oldBank)

		if (oldPageConfig[oldBank]) {
			result.config[newBank] = oldPageConfig[oldBank]
			upgradeBankStyle(result.config[newBank])
		}

		if (oldPageActions[oldBank]) {
			result.actions[newBank] = oldPageActions[oldBank]
		}
		if (oldPageReleaseActions[oldBank]) {
			result.release_actions[newBank] = oldPageReleaseActions[oldBank]
		}
		if (oldPageFeedbacks[oldBank]) {
			result.feedbacks[newBank] = oldPageFeedbacks[oldBank]
		}
	}

	// Add navigation keys
	result.config[1] = { style: 'pageup' }
	result.config[9] = { style: 'pagenum' }
	result.config[17] = { style: 'pagedown' }

	return result
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
function convertImport15To32(obj: any): any {
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

function from12to32(key: number): number {
	key = key - 1

	const rows = Math.floor(key / 4)
	const col = (key % 4) + 2
	const res = rows * 8 + col

	if (res >= 32) {
		console.debug('assert: old config had bigger pages than expected')
		return 32
	}
	return res
}

function upgradeBankStyle(config: any) {
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
