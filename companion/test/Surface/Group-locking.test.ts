import EventEmitter from 'node:events'
import { beforeEach, describe, expect, it } from 'vitest'
import { SurfaceGroupConfigSchema } from '@companion-app/shared/Model/Surfaces.js'
import { SurfaceGroup } from '../../lib/Surface/Group.js'
import { FakeDataDatabase } from '../utils/FakeTableView.js'

/**
 * These tests exercise the `never_lock` masking behaviour of `SurfaceGroup`:
 * `#isLocked` tracks the intended lock state, and `never_lock` suppresses it
 * only when pushing to the member surfaces.
 * It also covers how a group loads its config.
 */

interface FakeSurface {
	surfaceId: string
	displayName: string
	lockLog: boolean[]
	readonly lastLocked: boolean | undefined
	setLocked: (locked: boolean, skipDraw?: boolean) => boolean
	storeNewDevicePage: () => void
	getGroupConfig: () => any
	saveGroupConfig: (config: any) => void
}

function makeSurface(id: string, autoGroupConfig: any = {}): FakeSurface {
	return {
		surfaceId: id,
		displayName: id,
		lockLog: [],
		get lastLocked() {
			return this.lockLog[this.lockLog.length - 1]
		},
		setLocked(locked: boolean) {
			this.lockLog.push(locked)
			return true
		},
		storeNewDevicePage() {},
		getGroupConfig: () => autoGroupConfig,
		saveGroupConfig(config: any) {
			autoGroupConfig = config
		},
	}
}

function makeDeps(storedGroupConfig: Record<string, any> = {}) {
	const db = new FakeDataDatabase()
	db.getTableView('surface_groups').data = structuredClone(storedGroupConfig)
	const dbTable = db.getSchemaTableView('surface_groups', SurfaceGroupConfigSchema)
	const pageStore = {
		getFirstPageId: () => 'page-1',
		isPageIdValid: (id: string) => id === 'page-1',
		getPageInfo: () => undefined,
		on: () => {},
		off: () => {},
	}
	const userconfig = { getKey: () => undefined }
	const surfaceController = { emit: () => {} }
	const updateEvents = new EventEmitter()

	return { db, dbTable, pageStore, userconfig, surfaceController, updateEvents }
}

function makeGroup(opts: {
	groupId: string
	soleHandler?: FakeSurface | null
	isLocked?: boolean
	storedConfig?: Record<string, any>
}): SurfaceGroup {
	return makeGroupWithDeps(opts).group
}

function makeGroupWithDeps(opts: {
	groupId: string
	soleHandler?: FakeSurface | null
	isLocked?: boolean
	storedConfig?: Record<string, any>
}) {
	const deps = makeDeps(opts.storedConfig ?? {})
	const group = new SurfaceGroup(
		deps.surfaceController as any,
		deps.dbTable as any,
		deps.pageStore as any,
		deps.userconfig as any,
		deps.updateEvents,
		opts.groupId,
		(opts.soleHandler ?? null) as any,
		opts.isLocked ?? false
	)
	return { group, ...deps }
}

describe('SurfaceGroup never_lock masking', () => {
	describe('explicit (multi-surface) group', () => {
		let group: SurfaceGroup
		let s1: FakeSurface
		let s2: FakeSurface

		beforeEach(() => {
			group = makeGroup({ groupId: 'explicit-1', soleHandler: null, isLocked: false })
			s1 = makeSurface('s1')
			s2 = makeSurface('s2')
			group.attachSurface(s1 as any)
			group.attachSurface(s2 as any)
		})

		it('locks all member surfaces when the group locks', () => {
			group.setLocked(true)
			expect(s1.lastLocked).toBe(true)
			expect(s2.lastLocked).toBe(true)
		})

		it('suppresses the lock on the surfaces while never_lock is on, but restores it when turned off', () => {
			group.setLocked(true)
			expect(s1.lastLocked).toBe(true)

			// Turning never_lock on must push the surfaces unlocked...
			group.setGroupConfigValue('never_lock', true)
			expect(s1.lastLocked).toBe(false)
			expect(s2.lastLocked).toBe(false)

			// ...without losing the intended locked state - turning it back off re-locks them
			group.setGroupConfigValue('never_lock', false)
			expect(s1.lastLocked).toBe(true)
			expect(s2.lastLocked).toBe(true)
		})

		it('never pushes a locked state while never_lock is on', () => {
			group.setGroupConfigValue('never_lock', true)
			group.setLocked(true)
			expect(s1.lastLocked).toBe(false)
			expect(s2.lastLocked).toBe(false)
		})

		it('keeps a surface unlocked when it joins a never_lock group that intends to be locked', () => {
			group.setLocked(true)
			group.setGroupConfigValue('never_lock', true)

			const s3 = makeSurface('s3')
			group.attachSurface(s3 as any)

			expect(s3.lastLocked).toBe(false)
		})
	})

	describe('group configured to never_lock from the start', () => {
		it('does not lock its surfaces', () => {
			const group = makeGroup({
				groupId: 'explicit-2',
				soleHandler: null,
				isLocked: false,
				storedConfig: { 'explicit-2': { name: 'g', use_last_page: true, never_lock: true } },
			})
			const s1 = makeSurface('s1')
			group.attachSurface(s1 as any)

			group.setLocked(true)

			expect(s1.lastLocked).toBe(false)
		})
	})

	describe('auto-group', () => {
		it('masks and restores the lock for its sole surface', () => {
			const surface = makeSurface('auto-1', { never_lock: true })
			const group = makeGroup({ groupId: 'auto-1', soleHandler: surface, isLocked: false })

			// Intends to lock, but never_lock suppresses it
			group.setLocked(true)
			expect(surface.lastLocked).toBe(false)

			// Turning never_lock off restores the intended lock
			group.setGroupConfigValue('never_lock', false)
			expect(surface.lastLocked).toBe(true)
		})
	})
})

describe('SurfaceGroup config loading', () => {
	const defaultsOnFirstPage = {
		name: 'Unnamed group',
		last_page_id: 'page-1',
		startup_page_id: 'page-1',
		use_last_page: true,
		never_lock: false,
		restrict_pages: false,
		allowed_page_ids: [],
	}

	it('stores the defaults for a group without any config', () => {
		const { group, db } = makeGroupWithDeps({ groupId: 'new' })

		expect(group.groupConfig).toEqual(defaultsOnFirstPage)
		expect(db.getTableView('surface_groups').data['new']).toMatchObject({ name: 'Unnamed group', never_lock: false })
	})

	it('fills in defaults for an old config', () => {
		const group = makeGroup({ groupId: 'old', storedConfig: { old: { name: 'Desk', never_lock: true } } })

		expect(group.groupConfig).toEqual({ ...defaultsOnFirstPage, name: 'Desk', never_lock: true })
	})

	describe('auto group', () => {
		it('fills in defaults, naming it "Auto group"', () => {
			const group = makeGroup({ groupId: 's1', soleHandler: makeSurface('s1', { never_lock: true }) })

			expect(group.groupConfig).toEqual({ ...defaultsOnFirstPage, name: 'Auto group', never_lock: true })
		})

		it('an empty name is replaced', () => {
			const group = makeGroup({ groupId: 's1', soleHandler: makeSurface('s1', { name: '' }) })

			expect(group.groupConfig.name).toBe('Auto group')
		})

		it('keeps its name', () => {
			const group = makeGroup({ groupId: 's1', soleHandler: makeSurface('s1', { name: 'Mine' }) })

			expect(group.groupConfig.name).toBe('Mine')
		})

		it('an invalid config is replaced with the defaults', () => {
			const group = makeGroup({
				groupId: 's1',
				soleHandler: makeSurface('s1', { name: 'Mine', never_lock: 'sometimes' }),
			})

			expect(group.groupConfig).toEqual({ ...defaultsOnFirstPage, name: 'Auto group' })
		})
	})
})
