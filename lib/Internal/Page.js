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

export default class Page extends CoreBase {
	constructor(registry, internalModule) {
		super(registry, 'internal', 'Internal/Page')

		// this.internalModule = internalModule

		this.page.on('name', this.nameChange.bind(this))
	}

	nameChange(page, name) {
		this.internalModule.setVariables({
			[`page_number_${page}_name`]: name ?? '',
		})
	}

	getVariableDefinitions() {
		const variables = []
		for (let i = 1; i < 99; i++) {
			variables.push({
				name: `page_number_${i}_name`,
				label: `Page ${i} name`,
			})
		}
		return variables
	}

	updateVariables() {
		const variables = {}
		for (let i = 1; i < 99; i++) {
			variables[`page_number_${i}_name`] = this.page.getPageName(i) || ''
		}
		this.internalModule.setVariables(variables)
	}
}
