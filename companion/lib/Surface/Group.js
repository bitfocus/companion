// @ts-check
/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 *
 */

import { cloneDeep } from 'lodash-es'
import LogController from '../Log/Controller.js'

/**
 * @typedef {import('./Handler.js').default} SurfaceHandler
 */

export class SurfaceGroup {
	/**
	 * The defaults config for a group
	 * @type {import('@companion-app/shared/Model/Surfaces.js').SurfaceGroupConfig}
	 * @access public
	 * @static
	 */
	static DefaultOptions = {
		name: 'Unnamed group',
		last_page: 1,
		startup_page: 1,
		use_last_page: true,
	}

	/**
	 * Id of this group
	 * @type {string}
	 * @access public
	 */
	groupId

	/**
	 * The current page of this surface group
	 * @type {number}
	 * @access private
	 */
	#currentPage = 1

	/**
	 * The surfaces belonging to this group
	 * @type {SurfaceHandler[]}
	 * @access private
	 */
	surfaceHandlers = []

	/**
	 * Whether this is an auto-group to wrap a single surface handler
	 * @type {boolean}
	 * @access private
	 */
	#isAutoGroup = false

	/**
	 * Whether surfaces in this group should be locked
	 * @type {boolean}
	 * @access private
	 */
	#isLocked = false

	/**
	 * Configuration of this surface group
	 * @type {import('@companion-app/shared/Model/Surfaces.js').SurfaceGroupConfig}
	 * @access public
	 */
	groupConfig

	/**
	 * The logger
	 * @type {import('winston').Logger}
	 * @access private
	 */
	#logger

	/**
	 * @type {import('../Surface/Controller.js').default}
	 * @access public
	 */
	#surfaceController

	/**
	 * The core database library
	 * @type {import('../Data/Database.js').default}
	 * @access public
	 */
	#db
	/**
	 * The core user config manager
	 * @type {import('../Data/UserConfig.js').default}
	 * @access public
	 */
	#userconfig

	/**
	 * @param {import('../Surface/Controller.js').default} surfaceController
	 * @param {import('../Data/Database.js').default} db
	 * @param {import('../Data/UserConfig.js').default} userconfig
	 * @param {string} groupId
	 * @param {SurfaceHandler | null} soleHandler
	 * @param {boolean} isLocked
	 */
	constructor(surfaceController, db, userconfig, groupId, soleHandler, isLocked) {
		this.#logger = LogController.createLogger(`Surface/Group/${groupId}`)

		this.#surfaceController = surfaceController
		this.#db = db
		this.#userconfig = userconfig

		this.groupId = groupId
		this.#isLocked = isLocked

		// Load the appropriate config
		if (soleHandler) {
			this.groupConfig = soleHandler.getGroupConfig() ?? {}
			if (!this.groupConfig.name) this.groupConfig.name = 'Auto group'

			this.#isAutoGroup = true
		} else {
			this.groupConfig = this.#db.getKey('surface-groups', {})[this.groupId] || {}
		}
		// Apply missing defaults
		this.groupConfig = {
			...cloneDeep(SurfaceGroup.DefaultOptions),
			...this.groupConfig,
		}

		// Determine the correct page to use
		if (this.groupConfig.use_last_page) {
			this.#currentPage = this.groupConfig.last_page ?? 1
		} else {
			this.#currentPage = this.groupConfig.last_page = this.groupConfig.startup_page ?? 1
		}

		// Now attach and setup the surface
		if (soleHandler) this.attachSurface(soleHandler)

		this.#saveConfig()
	}

	/**
	 * Stop anything processing this group, it is being marked as inactive
	 */
	dispose() {
		// Nothing to do (yet)
	}

	/**
	 * Delete this group from the config
	 */
	forgetConfig() {
		const groupsConfig = this.#db.getKey('surface-groups', {})
		delete groupsConfig[this.groupId]
		this.#db.setKey('surface-groups', groupsConfig)
	}

	/**
	 * Check if this SurfaceGroup is an automatically generated group for a standalone surface
	 */
	get isAutoGroup() {
		return this.#isAutoGroup
	}

	/**
	 * Get the displayname of this surface group
	 */
	get displayName() {
		const firstHandler = this.surfaceHandlers[0]
		if (this.#isAutoGroup && firstHandler) {
			return firstHandler.displayName
		} else {
			return this.groupConfig.name
		}
	}

	/**
	 * Add a surface to be run by this group
	 * @param {SurfaceHandler} surfaceHandler
	 * @returns {void}
	 */
	attachSurface(surfaceHandler) {
		if (this.#isAutoGroup && this.surfaceHandlers.length)
			throw new Error(`Cannot add surfaces to group: "${this.groupId}"`)

		this.surfaceHandlers.push(surfaceHandler)

		surfaceHandler.setLocked(this.#isLocked, true)
		surfaceHandler.storeNewDevicePage(this.#currentPage, true)
	}

	/**
	 * Detach a surface from this group
	 * @param {SurfaceHandler} surfaceHandler
	 * @returns {void}
	 */
	detachSurface(surfaceHandler) {
		const surfaceId = surfaceHandler.surfaceId
		this.surfaceHandlers = this.surfaceHandlers.filter((handler) => handler.surfaceId !== surfaceId)
	}

	/**
	 * Perform page-down for this surface group
	 * @returns {void}
	 */
	doPageDown() {
		if (this.#userconfig.getKey('page_direction_flipped') === true) {
			this.#increasePage()
		} else {
			this.#decreasePage()
		}
	}

	/**
	 * Set the current page of this surface group
	 * @param {number} newPage
	 * @param {boolean} defer
	 * @returns {void}
	 */
	setCurrentPage(newPage, defer = false) {
		if (newPage == 100) {
			newPage = 1
		}
		if (newPage == 0) {
			newPage = 99
		}
		this.#storeNewPage(newPage, defer)
	}

	/**
	 * Get the current page of this surface group
	 * @returns {number}
	 */
	getCurrentPage() {
		return this.#currentPage
	}

	/**
	 * Perform page-up for this surface group
	 * @returns {void}
	 */
	doPageUp() {
		if (this.#userconfig.getKey('page_direction_flipped') === true) {
			this.#decreasePage()
		} else {
			this.#increasePage()
		}
	}

	#increasePage() {
		let newPage = this.#currentPage + 1
		if (newPage >= 100) {
			newPage = 1
		}
		if (newPage <= 0) {
			newPage = 99
		}

		this.#storeNewPage(newPage)
	}

	#decreasePage() {
		let newPage = this.#currentPage - 1
		if (newPage >= 100) {
			newPage = 1
		}
		if (newPage <= 0) {
			newPage = 99
		}

		this.#storeNewPage(newPage)
	}

	/**
	 * Update to a new page number
	 * @param {number} newPage
	 * @param {boolean} defer
	 * @returns {void}
	 */
	#storeNewPage(newPage, defer = false) {
		this.#currentPage = this.groupConfig.last_page = newPage
		this.#saveConfig()

		this.#surfaceController.emit('group_page', this.groupId, newPage)

		// Future: this is not ideal, but is the best approach for this reactivity for now
		const changedVariables = new Set(['this:page', 'this:page_name'])

		for (const surfaceHandler of this.surfaceHandlers) {
			surfaceHandler.storeNewDevicePage(newPage, defer)

			if (surfaceHandler.panel.onVariablesChanged) surfaceHandler.panel.onVariablesChanged(changedVariables)
		}
	}

	/**
	 * Update the config for this SurfaceGroup
	 * @param {string} key Config field to change
	 * @param {any} value New value for the field
	 * @returns
	 */
	setGroupConfigValue(key, value) {
		this.#logger.debug(`Set config "${key}" to "${value}"`)
		switch (key) {
			case 'use_last_page': {
				value = Boolean(value)

				this.groupConfig.use_last_page = value
				this.#saveConfig()

				return
			}
			case 'startup_page': {
				value = Number(value)
				if (isNaN(value)) {
					this.#logger.warn(`Invalid startup_page "${value}"`)
					return 'invalid value'
				}

				this.groupConfig.startup_page = value
				this.#saveConfig()

				return
			}
			case 'last_page': {
				value = Number(value)
				if (isNaN(value)) {
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
	 * @param {boolean} locked
	 * @returns {void}
	 */
	setLocked(locked) {
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
	 * @param {string} name
	 * @returns {void}
	 */
	setName(name) {
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
			const groupsConfig = this.#db.getKey('surface-groups', {})
			groupsConfig[this.groupId] = this.groupConfig
			this.#db.setKey('surface-groups', groupsConfig)
		}
	}
}
