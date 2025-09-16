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

import { cloneDeep } from 'lodash-es'
import LogController, { type Logger } from '../Log/Controller.js'
import type { SurfaceHandler } from './Handler.js'
import type { SurfaceGroupConfig } from '@companion-app/shared/Model/Surfaces.js'
import type { SurfaceController } from './Controller.js'
import type { IPageStore } from '../Page/Store.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import type { DataStoreTableView } from '../Data/StoreBase.js'
import EventEmitter from 'node:events'
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
			...cloneDeep(SurfaceGroup.DefaultOptions),
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
		if (!this.#pageStore.isPageIdValid(this.#currentPageId)) {
			this.#currentPageId = this.#pageStore.getFirstPageId()

			// Update the config to match
			this.groupConfig.last_page_id = this.#currentPageId
			this.groupConfig.startup_page_id = this.#currentPageId
		}

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
	 * Perform page-down for this surface group
	 */
	doPageDown(): void {
		if (this.#userconfig.getKey('page_direction_flipped') === true) {
			this.#increasePage()
		} else {
			this.#decreasePage()
		}
	}

	/**
	 * Set the current page of this surface group
	 */
	setCurrentPage(newPageId: string, defer = false): void {
		if (!this.#pageStore.isPageIdValid(newPageId)) return

		this.#storeNewPage(newPageId, defer)
	}

	/**
	 * Get the current page of this surface group
	 */
	getCurrentPageId(): string {
		return this.#currentPageId
	}

	/**
	 * Perform page-up for this surface group
	 */
	doPageUp(): void {
		if (this.#userconfig.getKey('page_direction_flipped') === true) {
			this.#decreasePage()
		} else {
			this.#increasePage()
		}
	}

	#increasePage() {
		const newPageId = this.#pageStore.getOffsetPageId(this.#currentPageId, 1)
		if (!newPageId) return
		this.setCurrentPage(newPageId)
	}

	#decreasePage() {
		const newPageId = this.#pageStore.getOffsetPageId(this.#currentPageId, -1)
		if (!newPageId) return
		this.setCurrentPage(newPageId)
	}

	/**
	 * Update the current page if the total number of pages change
	 */
	#pageCountChange = (_pageCount: number): void => {
		if (!this.#pageStore.isPageIdValid(this.#currentPageId)) {
			// TODO - choose a better value?
			this.#storeNewPage(this.#pageStore.getFirstPageId(), true)
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
		switch (key) {
			case 'use_last_page': {
				value = Boolean(value)

				this.groupConfig.use_last_page = value
				this.#saveConfig()

				return
			}
			case 'startup_page_id': {
				value = String(value)
				if (!this.#pageStore.isPageIdValid(value)) {
					this.#logger.warn(`Invalid startup_page "${value}"`)
					return 'invalid value'
				}

				this.groupConfig.startup_page_id = value
				this.#saveConfig()

				return
			}
			case 'last_page_id': {
				value = String(value)
				if (!this.#pageStore.isPageIdValid(value)) {
					this.#logger.warn(`Invalid current_page "${value}"`)
					return 'invalid value'
				}

				this.#storeNewPage(value)

				return
			}
			default:
				this.#logger.warn(`Cannot set unknown config field "${key}"`)
				return 'invalid key'
		}
	}

	/**
	 * Set the surface as locked
	 */
	setLocked(locked: boolean): void {
		// // skip if surface can't be locked
		// if (this.#surfaceConfig.config.never_lock) return

		// Track the locked status
		this.#isLocked = !!locked

		// If it changed, redraw
		for (const surface of this.surfaceHandlers) {
			surface.setLocked(locked)
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
