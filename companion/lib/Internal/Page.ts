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

import type { VariableDefinitionTmp } from '../Instance/Wrapper.js'
import type { PageController } from '../Page/Controller.js'
import type {
	ActionForVisitor,
	FeedbackForVisitor,
	InternalModuleFragment,
	InternalModuleFragmentEvents,
	InternalVisitor,
} from './Types.js'
import type { CompanionVariableValues } from '@companion-module/base'
import { EventEmitter } from 'events'
import type { InternalModuleUtils } from './Util.js'

export class InternalPage extends EventEmitter<InternalModuleFragmentEvents> implements InternalModuleFragment {
	// #logger = LogController.createLogger('Internal/Page')

	readonly #pageController: PageController

	constructor(_internalUtils: InternalModuleUtils, pageController: PageController) {
		super()

		this.#pageController = pageController

		this.#pageController.on('name', this.#nameChange.bind(this))
		this.#pageController.on('pagecount', () => this.emit('regenerateVariables'))
	}

	#nameChange(page: number, name: string | undefined): void {
		this.emit('setVariables', {
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
		this.emit('setVariables', variables)
	}

	visitReferences(_visitor: InternalVisitor, _actions: ActionForVisitor[], _feedbacks: FeedbackForVisitor[]): void {
		// Nothing to do
	}
}
