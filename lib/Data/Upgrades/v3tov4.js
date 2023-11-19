import { cloneDeep } from 'lodash-es'
import { oldBankIndexToXY } from '../../Shared/ControlId.js'
import { nanoid } from 'nanoid'

/**
 * Create an old-style bank controlId
 * @param {string | number} page
 * @param {number} bank
 * @returns {string}
 */
function CreateBankControlIdOld(page, bank) {
	return `bank:${page}-${bank}`
}

/**
 * @param {import('../Database.js').default} db
 * @returns {void}
 */
function addControlIdsToPages(db) {
	const controls = db.getKey('controls', {})
	const pages = db.getKey('page', {})

	const maxButtons = 32
	const perRow = 8

	for (const [number, page] of Object.entries(pages)) {
		if (!page.controls) {
			page.controls = {}

			for (let bank = 0; bank < maxButtons; bank++) {
				const controlId = CreateBankControlIdOld(number, bank + 1)
				if (controls[controlId]) {
					const row = Math.floor(bank / perRow)
					const column = bank % perRow
					if (!page.controls[row]) page.controls[row] = {}
					page.controls[row][column] = controlId
				}
			}
		}
	}
}

/**
 * do the database upgrades to convert from the v3 to the v4 format
 * @param {import('../Database.js').default} db
 * @param {import('winston').Logger} _logger
 * @returns {void}
 */
function convertDatabaseToV4(db, _logger) {
	addControlIdsToPages(db)

	// If xkeys was previously enabled, then preserve the old layout
	const userconfig = db.getKey('userconfig', {})
	if (userconfig.xkeys_enable && userconfig.xkeys_legacy_layout === undefined) {
		userconfig.xkeys_legacy_layout = true
	}
}

/**
 * Parse an old-style bank controlId
 * @param {string} controlId
 * @returns
 */
function ParseBankControlId(controlId) {
	if (typeof controlId === 'string') {
		const match = controlId.match(/^bank:(\d+)-(\d+)$/)
		if (match) {
			return {
				type: 'bank',
				page: Number(match[1]),
				bank: Number(match[2]),
			}
		}
	}

	return undefined
}

/**
 * @param {{ triggers?: import('../../Shared/Model/TriggerModel.js').TriggerModel[] | Record<string, import('../../Shared/Model/TriggerModel.js').TriggerModel>; }} obj
 */
function ensureTriggersAreObject(obj) {
	if (obj.triggers && Array.isArray(obj.triggers)) {
		/** @type {Record<string, import('../../Shared/Model/TriggerModel.js').TriggerModel>} */
		const triggersObj = {}
		for (const trigger of obj.triggers) {
			triggersObj[nanoid()] = trigger
		}
		obj.triggers = triggersObj
	}
}

/**
 * @param {any} obj
 * @returns {void}
 */
function convertImportToV4(obj) {
	if (obj.type == 'full') {
		const newObj = { ...obj }
		newObj.pages = cloneDeep(newObj.pages)
		delete newObj.controls

		for (const page of Object.values(newObj.pages)) {
			page.controls = {}
		}

		for (const [controlId, controlObj] of Object.entries(obj.controls)) {
			const parsedId = ParseBankControlId(controlId)
			if (!parsedId) continue

			const xy = oldBankIndexToXY(parsedId.bank)
			const pageInfo = newObj.pages[parsedId.page]
			if (xy && pageInfo) {
				if (!pageInfo.controls[xy[1]]) pageInfo.controls[xy[1]] = {}
				pageInfo.controls[xy[1]][xy[0]] = controlObj
			}
		}

		ensureTriggersAreObject(newObj)

		return newObj
	} else if (obj.type == 'page') {
		const newObj = { ...obj }
		newObj.page = cloneDeep(newObj.page)
		delete newObj.controls

		newObj.page.controls = {}
		for (const [controlId, controlObj] of Object.entries(obj.controls)) {
			const parsedId = ParseBankControlId(controlId)
			if (!parsedId) continue
			const xy = oldBankIndexToXY(parsedId.bank)
			if (xy) {
				if (!newObj.page.controls[xy[1]]) newObj.page.controls[xy[1]] = {}
				newObj.page.controls[xy[1]][xy[0]] = controlObj
			}
		}

		return newObj
	} else {
		ensureTriggersAreObject(obj)

		// No change
		return obj
	}
}

export default {
	upgradeStartup: convertDatabaseToV4,
	upgradeImport: convertImportToV4,
}
