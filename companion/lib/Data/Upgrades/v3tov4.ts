import { cloneDeep } from 'lodash-es'
import { oldBankIndexToXY } from '@companion-app/shared/ControlId.js'
import { nanoid } from 'nanoid'
import type { DataDatabase } from '../Database.js'
import type { Logger } from '../../Log/Controller.js'
import { TriggerModel } from '@companion-app/shared/Model/TriggerModel.js'

/**
 * Create an old-style bank controlId
 */
function CreateBankControlIdOld(page: string | number, bank: number): string {
	return `bank:${page}-${bank}`
}

function addControlIdsToPages(db: DataDatabase): void {
	const controls = db.getKey('controls', {})
	const pages = db.getKey('page', {})

	const maxButtons = 32
	const perRow = 8

	for (const [number, page] of Object.entries<any>(pages)) {
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
 */
function convertDatabaseToV4(db: DataDatabase, _logger: Logger) {
	addControlIdsToPages(db)

	// If xkeys was previously enabled, then preserve the old layout
	const userconfig = db.getKey('userconfig', {})
	if (userconfig.xkeys_enable && userconfig.xkeys_legacy_layout === undefined) {
		userconfig.xkeys_legacy_layout = true
	}
}

/**
 * Parse an old-style bank controlId
 */
function ParseBankControlId(controlId: string): any {
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

function ensureTriggersAreObject(obj: { triggers?: TriggerModel[] | Record<string, TriggerModel> }) {
	if (obj.triggers && Array.isArray(obj.triggers)) {
		const triggersObj: Record<string, TriggerModel> = {}
		for (const trigger of obj.triggers) {
			triggersObj[nanoid()] = trigger
		}
		obj.triggers = triggersObj
	}
}

function convertImportToV4(obj: any) {
	if (obj.type == 'full') {
		const newObj = { ...obj }
		newObj.pages = cloneDeep(newObj.pages)
		delete newObj.controls

		for (const page of Object.values<any>(newObj.pages)) {
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
