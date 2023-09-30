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
import CoreBase from '../Core/Base.js'

/**
 * @typedef {import('./Handler.js').default} SurfaceHandler
 */

export class SurfaceGroup extends CoreBase {
	/**
	 * The defaults config for a group
	 * @type {Object}
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
	 * Configuration of this surface group
	 * @type {object}
	 * @access public
	 */
	groupConfig

	/**
	 *
	 * @param {import('../Registry.js').default} registry
	 * @param {string} groupId
	 * @param {SurfaceHandler | null} soleHandler
	 */
	constructor(registry, groupId, soleHandler) {
		super(registry, `group(${groupId})`, `Surface/Group/${groupId}`)

		this.groupId = groupId

		// Load the appropriate config
		if (soleHandler) {
			if (!soleHandler.panelconfig.groupConfig) soleHandler.panelconfig.groupConfig = {}
			this.groupConfig = soleHandler.panelconfig.groupConfig
			if (!this.groupConfig.name) this.groupConfig.name = 'Auto group'

			this.#isAutoGroup = true
		} else {
			this.groupConfig = this.db.getKey('surface-groups', {})[this.groupId] || {}
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
		// TODO
	}

	/**
	 * Delete this group from the config
	 */
	forget() {
		const groupsConfig = this.db.getKey('surface-groups', {})
		delete groupsConfig[this.groupId]
		this.db.setKey('surface-groups', groupsConfig)
	}

	get isAutoGroup() {
		return this.#isAutoGroup
	}

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

		surfaceHandler.storeNewDevicePage(this.#currentPage, true) // TODO - defer?
	}

	/**
	 * Detach a surface from this group
	 * @param {SurfaceHandler} surfaceHandler
	 * @returns {void}
	 */
	detachSurface(surfaceHandler) {
		const surfaceId = surfaceHandler.deviceId
		this.surfaceHandlers = this.surfaceHandlers.filter((handler) => handler.deviceId !== surfaceId)
	}

	doPageDown() {
		if (this.userconfig.getKey('page_direction_flipped') === true) {
			this.#deviceIncreasePage()
		} else {
			this.#deviceDecreasePage()
		}
	}

	setCurrentPage(newPage, defer = false) {
		if (newPage == 100) {
			newPage = 1
		}
		if (newPage == 0) {
			newPage = 99
		}
		this.#storeNewDevicePage(newPage, defer)
	}

	getCurrentPage() {
		return this.#currentPage
	}

	doPageUp() {
		if (this.userconfig.getKey('page_direction_flipped') === true) {
			this.#deviceDecreasePage()
		} else {
			this.#deviceIncreasePage()
		}
	}

	#deviceIncreasePage() {
		let newPage = this.#currentPage + 1
		if (newPage >= 100) {
			newPage = 1
		}
		if (newPage <= 0) {
			newPage = 99
		}

		this.#storeNewDevicePage(newPage)
	}

	#deviceDecreasePage() {
		let newPage = this.#currentPage - 1
		if (newPage >= 100) {
			newPage = 1
		}
		if (newPage <= 0) {
			newPage = 99
		}

		this.#storeNewDevicePage(newPage)
	}

	#storeNewDevicePage(newPage, defer = false) {
		// TODO - variables?
		this.#currentPage = this.groupConfig.last_page = newPage
		this.#saveConfig()

		for (const surfaceHandler of this.surfaceHandlers) {
			surfaceHandler.storeNewDevicePage(newPage, defer)
		}
	}

	/**
	 * Update the config for this SurfaceGroup
	 * @param {string} key Config field to change
	 * @param {any} value New value for the field
	 * @returns
	 */
	setGroupConfigValue(key, value) {
		this.logger.debug(`Set config "${key}" to "${value}"`)
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
					this.logger.warn(`Invalid startup_page "${value}"`)
					return 'invalid value'
				}

				this.groupConfig.startup_page = value
				this.#saveConfig()

				return
			}
			case 'last_page': {
				value = Number(value)
				if (isNaN(value)) {
					this.logger.warn(`Invalid current_page "${value}"`)
					return 'invalid value'
				}

				this.#storeNewDevicePage(value)

				return
			}
			default:
				this.logger.warn(`Cannot set unknown config field "${key}"`)
				return 'invalid key'
		}
	}

	setName(name) {
		this.groupConfig.name = name || 'Unnamed group'
		this.#saveConfig()
	}

	#saveConfig() {
		if (this.#isAutoGroup) {
			// TODO: this does not feel great..
			const surface = this.surfaceHandlers[0]
			surface.panelconfig.groupConfig = this.groupConfig
			surface.saveConfig()
		} else {
			const groupsConfig = this.db.getKey('surface-groups', {})
			groupsConfig[this.groupId] = this.groupConfig
			this.db.setKey('surface-groups', groupsConfig)
		}
	}
}
