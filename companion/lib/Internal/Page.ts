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
import type { IPageStore } from '../Page/Store.js'
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
import type { PageModel } from '@companion-app/shared/Model/PageModel.js'

export class InternalPage extends EventEmitter<InternalModuleFragmentEvents> implements InternalModuleFragment {
	// #logger = LogController.createLogger('Internal/Page')

	readonly #pageStore: IPageStore

	constructor(_internalUtils: InternalModuleUtils, pageStore: IPageStore) {
		super()

		this.#pageStore = pageStore

		this.#pageStore.on('pageDataChanged', this.#nameChange.bind(this))
		this.#pageStore.on('pagecount', () => this.emit('regenerateVariables'))
	}

	#nameChange(page: number, pageData: PageModel | undefined): void {
		this.emit('setVariables', {
			[`page_number_${page}_name`]: pageData?.name,
		})
	}

	getVariableDefinitions(): VariableDefinitionTmp[] {
		const variables: VariableDefinitionTmp[] = []
		for (let i = 1; i <= this.#pageStore.getPageCount(); i++) {
			variables.push({
				name: `page_number_${i}_name`,
				label: `Page ${i} name`,
			})
		}
		return variables
	}

	updateVariables(): void {
		const variables: CompanionVariableValues = {}
		for (let i = 1; i <= this.#pageStore.getPageCount(); i++) {
			variables[`page_number_${i}_name`] = this.#pageStore.getPageName(i)
		}
		this.emit('setVariables', variables)
	}

	visitReferences(_visitor: InternalVisitor, _actions: ActionForVisitor[], _feedbacks: FeedbackForVisitor[]): void {
		// Nothing to do
	}
}
