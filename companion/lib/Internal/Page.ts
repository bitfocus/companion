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

import type { VariableDefinitionTmp } from '../Instance/Wrapper.js'
import type { InternalController } from './Controller.js'
import type { PageController } from '../Page/Controller.js'
import type { FeedbackForVisitor, InternalModuleFragment, InternalVisitor } from './Types.js'
import type { CompanionVariableValues } from '@companion-module/base'
import type { ActionInstance } from '@companion-app/shared/Model/ActionModel.js'

export class InternalPage implements InternalModuleFragment {
	// #logger = LogController.createLogger('Internal/Page')

	readonly #pageController: PageController
	readonly #internalModule: InternalController

	constructor(internalModule: InternalController, pageController: PageController) {
		this.#internalModule = internalModule
		this.#pageController = pageController

		this.#pageController.on('name', this.#nameChange.bind(this))
		this.#pageController.on('pagecount', () => this.#internalModule.regenerateVariables())
	}

	#nameChange(page: Number, name: string): void {
		this.#internalModule.setVariables({
			[`page_number_${page}_name`]: name,
		})
	}

	getVariableDefinitions(): VariableDefinitionTmp[] {
		const variables: VariableDefinitionTmp[] = []
		for (let i = 1; i <= this.#pageController.getPageCount(); i++) {
			variables.push({
				name: `page_number_${i}_name`,
				label: `Page ${i} name`,
			})
		}
		return variables
	}

	updateVariables(): void {
		const variables: CompanionVariableValues = {}
		for (let i = 1; i <= this.#pageController.getPageCount(); i++) {
			variables[`page_number_${i}_name`] = this.#pageController.getPageName(i)
		}
		this.#internalModule.setVariables(variables)
	}

	visitReferences(_visitor: InternalVisitor, _actions: ActionInstance[], _feedbacks: FeedbackForVisitor[]): void {
		// Nothing to do
	}
}
