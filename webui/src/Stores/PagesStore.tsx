import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { PageModel } from '@companion-app/shared/Model/PageModel.js'
import { ObservableMap, action, makeObservable, observable } from 'mobx'

export class PagesStoreModel {
	name: string

	readonly controls = observable.map<number, ObservableMap<number, string>>()

	constructor(name: string) {
		this.name = name

		makeObservable(this, {
			name: observable,
		})
	}
}

export class PagesStore {
	readonly store = observable.map<number, PagesStoreModel>()

	public get pageNumbers(): number[] {
		return Array.from(this.store.keys()).sort()
	}

	public get sortedEntries(): [number, PagesStoreModel][] {
		const entries = Array.from(this.store.entries())
		entries.sort((a, b) => a[0] - b[0])
		return entries
	}

	public getControlIdAt(pageNumber: number, row: number, column: number): string | undefined {
		return this.store.get(pageNumber)?.controls?.get(row)?.get(column)
	}

	public getControlIdAtLocation(location: ControlLocation): string | undefined {
		return this.getControlIdAt(location.pageNumber, location.row, location.column)
	}

	public reset = action((newData: Record<number, PageModel | undefined> | null): void => {
		this.store.clear()

		if (newData) {
			for (let i = 1; i <= 99; i++) {
				const pageInfo = newData[i]

				const newPageModel = new PagesStoreModel(pageInfo?.name ?? '')
				if (pageInfo) {
					for (const [row, rowObj] of Object.entries(pageInfo.controls)) {
						if (!rowObj) continue

						const newRowObj = observable.map<number, string>()
						newPageModel.controls.set(Number(row), newRowObj)

						for (const [col, controlId] of Object.entries(rowObj)) {
							if (!controlId) continue

							newRowObj.set(Number(col), controlId)
						}
					}
				}

				this.store.set(i, newPageModel)
			}
		}
	})

	public updatePage = action((pageNumber: number, pageInfo: PageModel) => {
		let pageInStore = this.store.get(pageNumber)
		if (!pageInStore) {
			pageInStore = new PagesStoreModel(pageInfo.name ?? '')
			this.store.set(pageNumber, pageInStore)
		}

		pageInStore.name = pageInfo.name ?? ''

		const validRowIds = new Set<number>()
		for (const [row, rowObj] of Object.entries(pageInfo.controls ?? {})) {
			if (!rowObj) continue
			validRowIds.add(Number(row))

			let storeRowObj = pageInStore.controls.get(Number(row))
			if (!storeRowObj) {
				storeRowObj = observable.map<number, string>()
				pageInStore.controls.set(Number(row), storeRowObj)
			}

			const validCols = new Set<number>()

			for (const [col, controlId] of Object.entries(rowObj)) {
				if (!controlId) continue
				validCols.add(Number(col))

				storeRowObj.set(Number(col), controlId)
			}

			// Clear any columns
			for (const col of storeRowObj.keys()) {
				if (!validCols.has(col)) storeRowObj.delete(col)
			}
		}

		// Remove any rows
		for (const row of pageInStore.controls.keys()) {
			if (!validRowIds.has(row)) pageInStore.controls.delete(row)
		}
	})
}
