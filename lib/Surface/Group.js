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

import CoreBase from '../Core/Base.js'

/**
 * @typedef {import('./Handler.js').default} SurfaceHandler
 */

export class SurfaceGroup extends CoreBase {
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
	 *
	 * @param {Registry} registry
	 * @param {string} groupId
	 * @param {SurfaceHandler | null} soleHandler
	 */
	constructor(registry, groupId, soleHandler) {
		super(registry, `group(${groupId})`, `Surface/Group/${groupId}`)

		this.groupId = groupId

		this.#currentPage = 1 // TODO - from config?

		this.groupConfig = this.db.getKey('surface-groups', {})[this.groupId] || {}
		if (!this.groupConfig.name) this.groupConfig.name = 'Unnamed group'
		// TODO - populate defaults

		if (soleHandler) {
			this.addSurface(soleHandler)
			this.#isAutoGroup = true
		}

		this.#saveConfig()
	}

	get isAutoGroup() {
		return this.#isAutoGroup
	}

	get displayName() {
		const firstHandler = this.surfaceHandlers[0]
		if (this.#isAutoGroup && firstHandler) {
			const handlerConfig = firstHandler.panelconfig
			return `${handlerConfig?.name || handlerConfig?.type || 'Unknown'} (${firstHandler.deviceId})`
		} else {
			return this.groupConfig.name
		}
	}

	/**
	 * Add a surface to be run by this group
	 * @param {SurfaceHandler} surfaceHandler
	 */
	addSurface(surfaceHandler) {
		if (this.#isAutoGroup) throw new Error(`Cannot add surfaces to group: "${this.groupId}"`)

		this.surfaceHandlers.push(surfaceHandler)

		surfaceHandler.storeNewDevicePage(this.#currentPage, true) // TODO - defer?
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
		let newPage = this.currentPage + 1
		if (newPage >= 100) {
			newPage = 1
		}
		if (newPage <= 0) {
			newPage = 99
		}

		this.#storeNewDevicePage(newPage)
	}

	#deviceDecreasePage() {
		let newPage = this.currentPage - 1
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
		this.#currentPage = newPage

		for (const surfaceHandler of this.surfaceHandlers) {
			surfaceHandler.storeNewDevicePage(newPage, defer)
		}
	}

	setName(name) {
		this.groupConfig.name = name || 'Unnamed group'
		this.#saveConfig()
	}

	#saveConfig() {
		if (this.#isAutoGroup) {
			// TODO
		} else {
			const groupsConfig = this.db.getKey('surface-groups', {})
			groupsConfig[this.groupId] = this.groupConfig
			this.db.setKey('surface-groups', groupsConfig)
		}
	}
}
