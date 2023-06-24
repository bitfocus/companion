import { cloneDeep } from 'lodash-es'
import { CreateBankControlId, formatCoordinate, oldBankIndexToCoordinate } from '../../Shared/ControlId.js'

function addControlIdsToPages(db) {
	const controls = db.getKey('controls', {})
	const pages = db.getKey('page', {})

	const maxButtons = 32
	const perRow = 8

	for (const [number, page] of Object.entries(pages)) {
		if (!page.controls) {
			page.controls = {}

			for (let bank = 0; bank < maxButtons; bank++) {
				const controlId = CreateBankControlId(number, bank + 1)
				if (controls[controlId]) {
					const coordinate = formatCoordinate(bank % perRow, Math.floor(bank / perRow))
					page.controls[coordinate] = controlId
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
			const coordinate = oldBankIndexToCoordinate(parsedId?.bank)
			const pageInfo = newObj.pages[parsedId?.page]
			if (parsedId && coordinate && pageInfo) {
				pageInfo.controls[coordinate] = controlObj
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
			const coordinate = oldBankIndexToCoordinate(parsedId?.bank)
			if (parsedId && coordinate) {
				newObj.page.controls[coordinate] = controlObj
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
