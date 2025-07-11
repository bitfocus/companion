import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { PageModelChanges, PageModel } from '@companion-app/shared/Model/PageModel.js'
import { ObservableMap, action, makeObservable, observable } from 'mobx'

export class PagesStoreModel {
	readonly id: string

	name: string

	readonly controls = observable.map<number, ObservableMap<number, string>>()

	constructor(id: string, name: string) {
		this.id = id
		this.name = name

		makeObservable(this, {
			name: observable,
		})
	}
}

export class PagesStore {
	private readonly store = observable.array<PagesStoreModel>()

	public get(pageNumber: number): PagesStoreModel | undefined {
		return this.store[pageNumber - 1]
	}

	public get data(): PagesStoreModel[] {
		return this.store
	}

	public get pageCount(): number {
		return this.store.length
	}

	public getControlIdAt(pageNumber: number, row: number, column: number): string | undefined {
		return this.get(pageNumber)?.controls?.get(row)?.get(column)
	}

	public getControlIdAtLocation(location: ControlLocation): string | undefined {
		return this.getControlIdAt(location.pageNumber, location.row, location.column)
	}

	public updateStore = action((change: PageModelChanges | null) => {
		if (!change) {
			this.store.clear()
			return
		}

		if (change.type === 'init') {
			this.store.clear()

			for (const id of change.order) {
				const newPageModel = this.#createModelForPage(id, change.pages[id])
				this.store.push(newPageModel)
			}

			return
		}

		const existingPagesMap = new Map<string, PagesStoreModel>()
		for (const pageModel of this.store) {
			existingPagesMap.set(pageModel.id, pageModel)
		}

		for (const pageChange of change.changes) {
			const pageModel = existingPagesMap.get(pageChange.id)
			if (!pageModel) continue // Should never happen

			if (pageChange.name != null) pageModel.name = pageChange.name

			for (const controlChange of pageChange.controls) {
				let rowObj = pageModel.controls.get(controlChange.row)
				if (!rowObj) {
					rowObj = observable.map<number, string>()
					pageModel.controls.set(controlChange.row, rowObj)
				}

				if (!controlChange.controlId) {
					rowObj.delete(controlChange.column)
				} else {
					rowObj.set(controlChange.column, controlChange.controlId)
				}
			}
		}
		for (const added of change.added) {
			existingPagesMap.set(added.id, this.#createModelForPage(added.id, added))
		}

		if (change.updatedOrder) {
			this.store.clear()
			for (const id of change.updatedOrder) {
				const model = existingPagesMap.get(id) ?? this.#createModelForPage(id, undefined)
				this.store.push(model)
			}
		}
	})

	#createModelForPage(id: string, pageInfo: PageModel | undefined): PagesStoreModel {
		const newPageModel = new PagesStoreModel(id, pageInfo?.name ?? '')

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

		return newPageModel
	}
}
