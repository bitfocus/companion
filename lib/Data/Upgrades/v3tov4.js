import { cloneDeep } from 'lodash-es'
import { oldBankIndexToXY } from '../../Shared/ControlId.js'

function CreateBankControlIdOld(page, bank) {
	return `bank:${page}-${bank}`
}

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

/** do the database upgrades to convert from the v3 to the v4 format */
function convertDatabaseToV4(db, logger) {
	addControlIdsToPages(db)
}

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
			const xy = oldBankIndexToXY(parsedId?.bank)
			const pageInfo = newObj.pages[parsedId?.page]
			if (parsedId && xy && pageInfo) {
				if (!pageInfo.controls[xy[1]]) pageInfo.controls[xy[1]] = {}
				pageInfo.controls[xy[1]][xy[0]] = controlObj
			}
		}

		return newObj
	} else if (obj.type == 'page') {
		const newObj = { ...obj }
		newObj.page = cloneDeep(newObj.page)
		delete newObj.controls

		newObj.page.controls = {}
		for (const [controlId, controlObj] of Object.entries(obj.controls)) {
			const parsedId = ParseBankControlId(controlId)
			const xy = oldBankIndexToXY(parsedId?.bank)
			if (parsedId && xy) {
				if (!pageInfo.controls[xy[1]]) pageInfo.controls[xy[1]] = {}
				pageInfo.controls[xy[1]][xy[0]] = controlObj
			}
		}

		return newObj
	} else {
		// No change
		return obj
	}
}

export default {
	upgradeStartup: convertDatabaseToV4,
	upgradeImport: convertImportToV4,
}
