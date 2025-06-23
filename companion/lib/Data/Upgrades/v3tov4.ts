import { cloneDeep } from 'lodash-es'
import { oldBankIndexToXY } from '@companion-app/shared/ControlId.js'
import { nanoid } from 'nanoid'
import type { DataStoreBase, DataStoreTableView } from '../StoreBase.js'
import type { Logger } from '../../Log/Controller.js'
import type { TriggerModel } from '@companion-app/shared/Model/TriggerModel.js'

/**
 * Create an old-style bank controlId
 */
function CreateBankControlIdOld(page: string | number, bank: number): string {
	return `bank:${page}-${bank}`
}

function addControlIdsToPages(mainTable: DataStoreTableView<any>): void {
	const controls = mainTable.get('controls') ?? {}
	const pages = mainTable.get('page') ?? {}

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

	mainTable.set('controls', controls)
	mainTable.set('page', pages)
}

/**
 * do the database upgrades to convert from the v3 to the v4 format
 */
function convertDatabaseToV4(db: DataStoreBase<any>, _logger: Logger): void {
	const mainTable = db.defaultTableView

	addControlIdsToPages(mainTable)

	// If xkeys was previously enabled, then preserve the old layout
	const userconfig = mainTable.get('userconfig')
	if (userconfig && userconfig.xkeys_enable && userconfig.xkeys_legacy_layout === undefined) {
		userconfig.xkeys_legacy_layout = true
		mainTable.set('userconfig', userconfig)
	}

	mainTable.set('surface-groups', {})

	mainTable.set('page_config_version', 4)
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

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
function convertImportToV4(obj: any): any {
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
