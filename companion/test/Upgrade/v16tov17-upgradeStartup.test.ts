import { beforeAll, describe, expect, it } from 'vitest'
import { createTables } from '../../lib/Data/Schema/v1.js'
import { DataStoreBase } from '../../lib/Data/StoreBase.js'
import v16tov17 from '../../lib/Data/Upgrades/v16tov17.js'
import LogController from '../../lib/Log/Controller.js'

class DataDatabase extends DataStoreBase<any> {
	constructor() {
		super(':memory:', '', 'main', 'Data/Database', () => {})
		this.startSQLite()
	}
	protected create(): void {
		createTables(this.store, this.defaultTable, this.logger)
	}
	protected loadDefaults(): void {}
	protected migrateFileToSqlite(): void {}
}

function element(id: string, type: string, extra: Record<string, any> = {}) {
	return { id, type, name: type, enabled: { isExpression: false, value: true }, ...extra }
}

describe('v16tov17 upgradeStartup', () => {
	const db = new DataDatabase()
	const logger = LogController.createLogger('test-logger')

	beforeAll(() => {
		const controls = db.getTableView('controls')

		controls.set('button', {
			type: 'button-layered',
			style: {
				layers: [
					element('canvas', 'canvas'),
					element('box0', 'box'),
					element('group0', 'group', { children: [element('inner', 'text')] }),
					element('text0', 'text'),
				],
			},
		})

		// A button whose elements were already pinned - a re-run must not undo the user's choices
		controls.set('already-pinned', {
			type: 'button-layered',
			style: { layers: [element('canvas', 'canvas'), element('text1', 'text', { pinnedProperties: ['weight'] })] },
		})

		// Controls without a layered style must be left alone
		controls.set('pageup', { type: 'pageup' })

		v16tov17.upgradeStartup(db, logger)
	})

	it('gives each element the defaults for its type', () => {
		const layers = db.getTableView('controls').get('button').style.layers
		expect(layers.find((l: any) => l.id === 'text0').pinnedProperties).toEqual([
			'text',
			'fontsize',
			'fontsizeAllowShrink',
			'color',
			'halign',
			'valign',
		])
		expect(layers.find((l: any) => l.id === 'box0').pinnedProperties).toEqual(['color'])
	})

	it('migrates elements nested inside a group', () => {
		const layers = db.getTableView('controls').get('button').style.layers
		const group = layers.find((l: any) => l.id === 'group0')
		expect(group.pinnedProperties).toEqual([])
		expect(group.children[0].pinnedProperties).toContain('text')
	})

	it('leaves the canvas without pins, as its properties are button-level', () => {
		const layers = db.getTableView('controls').get('button').style.layers
		expect(layers.find((l: any) => l.id === 'canvas').pinnedProperties).toBeUndefined()
	})

	it('keeps pins which are already set', () => {
		const layers = db.getTableView('controls').get('already-pinned').style.layers
		expect(layers.find((l: any) => l.id === 'text1').pinnedProperties).toEqual(['weight'])
	})

	it('leaves controls without a layered style untouched', () => {
		expect(db.getTableView('controls').get('pageup')).toEqual({ type: 'pageup' })
	})
})

describe('v16tov17 upgradeImport', () => {
	const logger = LogController.createLogger('test-logger')

	it('migrates the controls of an exported page', () => {
		const result: any = v16tov17.upgradeImport(
			{
				type: 'page',
				version: 16,
				companionBuild: undefined,
				page: {
					controls: {
						'0': {
							'0': {
								type: 'button-layered',
								style: { layers: [element('canvas', 'canvas'), element('text0', 'text')] },
							},
						},
					},
				},
			} as any,
			logger
		)

		expect(result.version).toBe(17)
		expect(result.page.controls['0']['0'].style.layers[1].pinnedProperties).toContain('text')
	})
})
