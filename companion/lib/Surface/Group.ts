/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 */

import LogController, { type Logger } from '../Log/Controller.js'
import type { SurfaceHandler } from './Handler.js'
import type { SurfaceGroupConfig } from '@companion-app/shared/Model/Surfaces.js'
import type { SurfaceController } from './Controller.js'
import type { IPageStore } from '../Page/Store.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import type { DataStoreTableView } from '../Data/StoreBase.js'
import type EventEmitter from 'node:events'
import type { UpdateEvents } from './Types.js'

export class SurfaceGroup {
	/**
	 * The defaults config for a group
	 */
	static readonly DefaultOptions: SurfaceGroupConfig = {
		name: 'Unnamed group',
		last_page_id: '',
		startup_page_id: '',
		use_last_page: true,
		restrict_pages: false,
		allowed_page_ids: [],
	}

	/**
	 * Id of this group
	 */
	readonly groupId: string

	/**
	 * The current page of this surface group
	 */
	#currentPageId: string

	/**
	 * Page history for surfaces
	 */
	readonly #pageHistory: { history: string[]; index: number }

	/**
	 * The surfaces belonging to this group
	 */
	surfaceHandlers: SurfaceHandler[] = []

	/**
	 * Whether this is an auto-group to wrap a single surface handler
	 */
	readonly #isAutoGroup: boolean = false

	/**
	 * Whether surfaces in this group should be locked
	 */
	#isLocked: boolean = false

	/**
	 * Configuration of this surface group
	 */
	groupConfig: SurfaceGroupConfig

	/**
	 * The logger
	 */
	#logger: Logger

	/**
	 */
	#surfaceController: SurfaceController
	/**
	 * The surface group config database
	 */
	#dbTable: DataStoreTableView<Record<string, SurfaceGroupConfig>>
	/**
	 * The core page controller
	 */
	#pageStore: IPageStore
	/**
	 * The core user config manager
	 */
	#userconfig: DataUserConfig

	#updateEvents: EventEmitter<UpdateEvents>

	constructor(
		surfaceController: SurfaceController,
		dbTable: DataStoreTableView<Record<string, SurfaceGroupConfig>>,
		pageStore: IPageStore,
		userconfig: DataUserConfig,
		updateEvents: EventEmitter<UpdateEvents>,
		groupId: string,
		soleHandler: SurfaceHandler | null,
		isLocked: boolean
	) {
		this.#logger = LogController.createLogger(`Surface/Group/${groupId}`)

		this.#surfaceController = surfaceController
		this.#dbTable = dbTable
		this.#pageStore = pageStore
		this.#userconfig = userconfig
		this.#updateEvents = updateEvents

		this.groupId = groupId
		this.#isLocked = isLocked

		// Load the appropriate config
		if (soleHandler) {
			this.groupConfig = soleHandler.getGroupConfig() ?? {}
			if (!this.groupConfig.name) this.groupConfig.name = 'Auto group'

			this.#isAutoGroup = true
		} else {
			this.groupConfig = this.#dbTable.getOrDefault(this.groupId, SurfaceGroup.DefaultOptions)
		}
		// Apply missing defaults
		this.groupConfig = {
			...structuredClone(SurfaceGroup.DefaultOptions),
			...this.groupConfig,
		}

		// Live fixup the last_page config
		if (this.groupConfig.last_page) {
			this.groupConfig.last_page_id =
				this.#pageStore.getPageInfo(this.groupConfig.last_page)?.id ?? this.groupConfig.last_page_id
			delete this.groupConfig.last_page
		}
		// Live fixup the startup_page config
		if (this.groupConfig.startup_page) {
			this.groupConfig.startup_page_id =
				this.#pageStore.getPageInfo(this.groupConfig.startup_page)?.id ?? this.groupConfig.startup_page_id
			delete this.groupConfig.startup_page
		}

		// Determine the correct page to use
		if (this.groupConfig.use_last_page) {
			this.#currentPageId = this.groupConfig.last_page_id ?? '' // Fixed later if needed
		} else {
			this.#currentPageId = this.groupConfig.last_page_id = this.groupConfig.startup_page_id ?? '' // Fixed later if needed
		}

		// validate the current page id
		if (!this.#isPageIdValid(this.#currentPageId)) {
			this.#currentPageId = this.#getFirstPageId()

			// Update the config to match
			this.groupConfig.last_page_id = this.#currentPageId
			this.groupConfig.startup_page_id = this.#currentPageId
		}

		this.#pageHistory = { history: [this.#currentPageId], index: 0 }

		// Now attach and setup the surface
		if (soleHandler) this.attachSurface(soleHandler)

		this.#saveConfig()
		this.#pageStore.on('pagecount', this.#pageCountChange)
		this.#pageStore.on('pageindexchange', this.#pageIndexChange)
	}

	/**
	 * Stop anything processing this group, it is being marked as inactive
	 */
	dispose(): void {
		this.#pageStore.off('pagecount', this.#pageCountChange)
		this.#pageStore.off('pageindexchange', this.#pageIndexChange)
	}

	/**
	 * Delete this group from the config
	 */
	forgetConfig(): void {
		this.#dbTable.delete(this.groupId)
		this.#updateEvents.emit(`groupConfig:${this.groupId}`, null)
	}

	/**
	 * Check if this SurfaceGroup is an automatically generated group for a standalone surface
	 */
	get isAutoGroup(): boolean {
		return this.#isAutoGroup
	}

	/**
	 * Get the displayname of this surface group
	 */
	get displayName(): string {
		const firstHandler = this.surfaceHandlers[0]
		if (this.#isAutoGroup && firstHandler) {
			return firstHandler.displayName
		} else {
			return this.groupConfig.name
		}
	}

	/**
	 * Add a surface to be run by this group
	 */
	attachSurface(surfaceHandler: SurfaceHandler): void {
		if (this.#isAutoGroup && this.surfaceHandlers.length)
			throw new Error(`Cannot add surfaces to group: "${this.groupId}"`)

		this.surfaceHandlers.push(surfaceHandler)

		surfaceHandler.setLocked(this.#isLocked, true)
		surfaceHandler.storeNewDevicePage(this.#currentPageId, true)
	}

	/**
	 * Detach a surface from this group
	 */
	detachSurface(surfaceHandler: SurfaceHandler): void {
		const surfaceId = surfaceHandler.surfaceId
		this.surfaceHandlers = this.surfaceHandlers.filter((handler) => handler.surfaceId !== surfaceId)
	}

	/**
	 * Get the current page of this surface group
	 */
	getCurrentPageId(): string {
		return this.#currentPageId
	}

	/**
	 * Perform page-down for this surface group
	 */
	doPageDown(): void {
		const increase = this.#userconfig.getKey('page_direction_flipped') === true
		this.setCurrentPage(increase ? '+1' : '-1')
	}

	/**
	 * Perform page-up for this surface group
	 */
	doPageUp(): void {
		const decrease = this.#userconfig.getKey('page_direction_flipped') === true
		this.setCurrentPage(decrease ? '-1' : '+1')
	}

	clearPageHistory(): void {
		this.#pageHistory.history = [this.#currentPageId]
		this.#pageHistory.index = 0
	}

	/**
	 * Return `groupConfig.allowed_page_ids` if `groupConfig.restrict_pages`, while ensuring that the pages are valid
	 * Return an empty list if `groupConfig.restrict_pages` is false
	 */
	#getAllowedPagesList(): string[] {
		if (this.groupConfig.restrict_pages) {
			const allowedPages = this.groupConfig.allowed_page_ids ?? []
			return allowedPages.filter((page) => this.#pageStore.isPageIdValid(page))
		} else {
			return []
		}
	}

	/**
	 * Get first page ID, taking into account `groupConfig.allowed_page_ids`
	 */
	#getFirstPageId(): string {
		const allowedPages = this.#getAllowedPagesList()
		return allowedPages.length > 0 ? allowedPages[0] : this.#pageStore.getFirstPageId()
	}

	/**
	 * Check if a page ID is valid, taking into account `groupConfig.allowed_page_ids`
	 */
	#isPageIdValid(pageID: string): boolean {
		// If page doesn't exist, we're done:
		if (!this.#pageStore.isPageIdValid(pageID)) {
			return false
		}

		// Otherwise, the result depends on whether restrictions are in place
		const allowedPages = this.#getAllowedPagesList()
		if (allowedPages.length > 0) {
			// page is valid only if it's in the "restricted" list
			return allowedPages.includes(pageID)
		} else {
			// page is valid and there are no page restrictions
			return true
		}
	}

	/**
	 * Change the page of a surface, keeping a history of previous pages
	 */
	setCurrentPage(toPage: string | 'back' | 'forward' | '+1' | '-1', defer = false): void {
		const currentPage = this.#currentPageId
		const pageHistory = this.#pageHistory

		if (toPage === 'back' || toPage === 'forward') {
			// first make sure the history list contains only valid pages...
			if (pageHistory.history.some((p) => !this.#isPageIdValid(p))) {
				pageHistory.history = pageHistory.history.filter((p) => this.#isPageIdValid(p))
				// not sure what's best here, but this should do...
				pageHistory.index = pageHistory.history.length - 1
			}

			// determine the 'to' page
			const pageDirection = toPage === 'back' ? -1 : 1
			const pageIndex = pageHistory.index + pageDirection
			const pageTarget = pageHistory.history[pageIndex]

			// change only if pageIndex points to a real page
			// note that in all common situations, the only way pageTarget is undefined
			// is when we're trying to go beyond the beginning or end of history,
			// in which case, doing nothing is the correct action.
			if (pageTarget !== undefined) {
				pageHistory.index = pageIndex
				if (!this.#isPageIdValid(pageTarget)) return

				this.#storeNewPage(pageTarget, defer)
			}
		} else {
			const allowedPages = this.#getAllowedPagesList()
			let newPage: string | null = toPage
			const getNewPage = (currentPage: string, offset: number) => {
				if (allowedPages.length > 0) {
					let newPage = (allowedPages.indexOf(currentPage) + offset) % allowedPages.length
					if (newPage < 0) newPage = allowedPages.length - 1
					return allowedPages[newPage]
				} else {
					// note: getOffsetPageId() calculates the new page with wrap around
					return this.#pageStore.getOffsetPageId(currentPage, offset)
				}
			}
			// note: getNewPage() calculates the new page with wrap around
			if (newPage === '+1') {
				newPage = getNewPage(currentPage, 1)
			} else if (newPage === '-1') {
				newPage = getNewPage(currentPage, -1)
			} else {
				newPage = String(newPage)
			}
			if (!newPage || !this.#isPageIdValid(newPage)) newPage = this.#getFirstPageId()

			// Change page
			this.#storeNewPage(newPage, defer)

			// Clear forward page history beyond current index, add new history entry, increment index;
			pageHistory.history = pageHistory.history.slice(0, pageHistory.index + 1)
			pageHistory.history.push(newPage)
			pageHistory.index += 1

			// Limit the max history
			const maxPageHistory = 100
			if (pageHistory.history.length > maxPageHistory) {
				const startIndex = pageHistory.history.length - maxPageHistory
				pageHistory.history = pageHistory.history.slice(startIndex)
				pageHistory.index = pageHistory.history.length - 1
			}
		}
	}

	/**
	 * Update the current page if the total number of pages change
	 */
	#pageCountChange = (_pageCount: number): void => {
		if (!this.#isPageIdValid(this.#currentPageId)) {
			// TODO - choose a better value?
			this.#storeNewPage(this.#getFirstPageId(), true)
		}
	}

	/**
	 * Update the current page if the index of the pages change
	 */
	#pageIndexChange = (pageIds: Set<string>): void => {
		if (pageIds.has(this.#currentPageId)) {
			for (const surfaceHandler of this.surfaceHandlers) {
				surfaceHandler.triggerRedraw(true)
			}
		}
	}

	/**
	 * Update to a new page number
	 */
	#storeNewPage(newPageId: string, defer = false): void {
		this.#currentPageId = this.groupConfig.last_page_id = newPageId
		this.#saveConfig()

		this.#surfaceController.emit('group_page', this.groupId, newPageId)

		// Future: this is not ideal, but is the best approach for this reactivity for now
		const changedVariables = new Set(['this:page', 'this:page_name'])

		for (const surfaceHandler of this.surfaceHandlers) {
			surfaceHandler.storeNewDevicePage(newPageId, defer)

			if (surfaceHandler.panel.onVariablesChanged) surfaceHandler.panel.onVariablesChanged(changedVariables)
		}
	}

	/**
	 * Update the config for this SurfaceGroup
	 * @param key Config field to change
	 * @param value New value for the field
	 */
	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	setGroupConfigValue(key: string, value: any): string | undefined {
		this.#logger.debug(`Set config "${key}" to "${value}"`)

		let newValue = null
		try {
			newValue = validateGroupConfigValue(this.#pageStore, key, value)
		} catch (e: any) {
			this.#logger.warn(`Set config failed: ${e?.message ?? e}`)
			return 'invalid value'
		}

		if (key === 'last_page_id') {
			this.#storeNewPage(value)

			return
		} else {
			;(this.groupConfig as any)[key] = newValue
			this.#saveConfig()

			return
		}
	}

	/**
	 * Set the surface as locked
	 * @returns whether the locked state changed
	 */
	setLocked(locked: boolean): boolean {
		// If an auto-group, just pass to the sole surface
		if (this.isAutoGroup) {
			return this.surfaceHandlers[0].setLocked(locked)
		}

		// // skip if surface can't be locked
		// if (this.#surfaceConfig.config.never_lock) return

		if (this.#isLocked === !!locked) {
			return false
		}

		// Track the locked status
		this.#isLocked = !!locked

		// If it changed, redraw
		for (const surface of this.surfaceHandlers) {
			surface.setLocked(locked)
		}

		return true
	}

	/**
	 * Ensure all surfaces in this group have the correct locked state
	 */
	syncLocked(): void {
		if (this.isAutoGroup) return

		for (const surface of this.surfaceHandlers) {
			surface.setLocked(this.#isLocked)
		}
	}

	/**
	 * Set the name of this surface group
	 */
	setName(name: string): void {
		this.groupConfig.name = name || 'Unnamed group'
		this.#saveConfig()

		this.#surfaceController.emit('group_name', this.groupId, this.groupConfig.name)
	}

	/**
	 * Save the configuration of this surface group
	 */
	#saveConfig() {
		if (this.#isAutoGroup) {
			// TODO: this does not feel great..
			const surface = this.surfaceHandlers[0]
			surface.saveGroupConfig(this.groupConfig)
		} else {
			this.#dbTable.set(this.groupId, this.groupConfig)
			this.#updateEvents.emit(`groupConfig:${this.groupId}`, this.groupConfig)
		}
	}
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function validateGroupConfigValue(pageStore: IPageStore, key: string, value: any): any {
	switch (key) {
		case 'use_last_page': {
			return Boolean(value)
		}
		case 'startup_page_id': {
			value = String(value)
			if (!pageStore.isPageIdValid(value)) {
				throw new Error(`Invalid startup_page "${value}"`)
			}

			return value
		}
		case 'last_page_id': {
			value = String(value)
			if (!pageStore.isPageIdValid(value)) {
				throw new Error(`Invalid current_page "${value}"`)
			}

			return value
		}
		case 'restrict_pages':
			return Boolean(value)

		case 'allowed_page_ids': {
			const values = value as string[]
			const errors = values.filter((page) => !pageStore.isPageIdValid(page))
			if (errors.length > 0) {
				throw new Error(`Invalid allowed_page_ids values: [${errors.join(',')}]`)
			}

			return values
		}
		default:
			throw new Error(`Invalid SurfaceGroup config key: "${key}"`)
	}
}
