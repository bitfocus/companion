import type { PageModel } from '@companion-app/shared/Model/PageModel.js'
import type { DataStoreTableView } from '../../lib/Data/StoreBase.js'
import { PageStore } from '../../lib/Page/Store.js'

/**
 * A Map-backed stand-in for DataStoreTableView.
 * Values are cloned on read and write, mirroring the JSON round-trip of the real SQLite table,
 * so `data` can be used to assert exactly what would have been persisted.
 */
export class FakePageTableView {
	data: Record<string, PageModel> = {}

	all(): Record<string, PageModel> {
		return structuredClone(this.data)
	}

	set(key: string, value: PageModel): void {
		this.data[key] = structuredClone(value)
	}

	delete(key: string): void {
		delete this.data[key]
	}

	asTableView(): DataStoreTableView<Record<string, PageModel>> {
		return this as unknown as DataStoreTableView<Record<string, PageModel>>
	}
}

export function makePage(id: string, name: string, controls: Record<number, Record<number, string>> = {}): PageModel {
	return { id, name, controls }
}

export function createStore(initialPages?: PageModel[]): { db: FakePageTableView; store: PageStore } {
	const db = new FakePageTableView()
	if (initialPages) {
		initialPages.forEach((page, index) => {
			db.data[`${index + 1}`] = structuredClone(page)
		})
	}

	const store = new PageStore(db.asTableView())
	return { db, store }
}

/** Three pages with a few controls, for tests that need an interesting layout */
export function threePages(): PageModel[] {
	return [
		makePage('page-a', 'First', { 0: { 0: 'control-a1' } }),
		makePage('page-b', 'Second', { 1: { 2: 'control-b1', 3: 'control-b2' } }),
		makePage('page-c', 'Third', { 0: { 0: 'control-c1' } }),
	]
}
