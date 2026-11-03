import { CreateBankControlId, type BankControlId } from '@companion-app/shared/ControlId.js'
import { PageModelSchema, type PageModel } from '@companion-app/shared/Model/PageModel.js'
import type { DataStoreSchemaTableView } from '../../lib/Data/Tables/SchemaTableView.js'
import { PageStore } from '../../lib/Page/Store.js'
import { FakeSchemaTableView, FakeTableView } from '../utils/FakeTableView.js'

/**
 * A Map-backed stand-in for the pages table.
 * Rows are parsed with the page schema like the real table, and `data` holds exactly what would have been persisted.
 */
export class FakePageTableView extends FakeTableView<PageModel> {
	asSchemaTableView(): DataStoreSchemaTableView<typeof PageModelSchema, string> {
		const view = new FakeSchemaTableView(this, PageModelSchema)
		return view as unknown as DataStoreSchemaTableView<typeof PageModelSchema, string>
	}
}

export function makePage(
	id: string,
	name: string,
	controls: Record<number, Record<number, BankControlId>> = {}
): PageModel {
	return { id, name, controls }
}

export function createStore(initialPages?: PageModel[]): { db: FakePageTableView; store: PageStore } {
	const db = new FakePageTableView()
	if (initialPages) {
		initialPages.forEach((page, index) => {
			db.data[`${index + 1}`] = structuredClone(page)
		})
	}

	const store = new PageStore(db.asSchemaTableView())
	return { db, store }
}

/** Three pages with a few controls, for tests that need an interesting layout */
export function threePages(): PageModel[] {
	return [
		makePage('page-a', 'First', { 0: { 0: CreateBankControlId('control-a1') } }),
		makePage('page-b', 'Second', { 1: { 2: CreateBankControlId('control-b1'), 3: CreateBankControlId('control-b2') } }),
		makePage('page-c', 'Third', { 0: { 0: CreateBankControlId('control-c1') } }),
	]
}
