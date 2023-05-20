import { CreateBankControlId, formatCoordinate } from '../../Shared/ControlId.js'

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

function convertImportToV4(obj) {
	throw new Error('Not implemented!')
}

export default {
	upgradeStartup: convertDatabaseToV4,
	upgradeImport: convertImportToV4,
}
