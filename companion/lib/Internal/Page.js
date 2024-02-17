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

// import LogController from '../Log/Controller.js'

export default class Page {
	// #logger = LogController.createLogger('Internal/Page')

	/**
	 * @type {import('../Page/Controller.js').default}
	 * @readonly
	 */
	#pageController

	/**
	 * @type {import('./Controller.js').default}
	 * @readonly
	 */
	#internalModule

	/**
	 *
	 * @param {import('./Controller.js').default} internalModule
	 * @param {import('../Page/Controller.js').default} pageController
	 */
	constructor(internalModule, pageController) {
		this.#internalModule = internalModule
		this.#pageController = pageController

		this.#pageController.on('name', this.#nameChange.bind(this))
	}

	/**
	 * @param {number} page
	 * @param {string} name
	 * @returns {void}
	 */
	#nameChange(page, name) {
		this.#internalModule.setVariables({
			[`page_number_${page}_name`]: name ?? '',
		})
	}

	/**
	 * @returns {import('../Instance/Wrapper.js').VariableDefinitionTmp[]}
	 */
	getVariableDefinitions() {
		/** @type {import('../Instance/Wrapper.js').VariableDefinitionTmp[]} */
		const variables = []
		for (let i = 1; i < 100; i++) {
			variables.push({
				name: `page_number_${i}_name`,
				label: `Page ${i} name`,
			})
		}
		return variables
	}

	updateVariables() {
		/** @type {Record<string, import('@companion-module/base').CompanionVariableValue | undefined>} */
		const variables = {}
		for (let i = 1; i < 100; i++) {
			variables[`page_number_${i}_name`] = this.#pageController.getPageName(i) || ''
		}
		this.#internalModule.setVariables(variables)
	}
}
