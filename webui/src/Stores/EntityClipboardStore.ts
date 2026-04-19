import { action, makeObservable, observable } from 'mobx'
import type { SomeEntityModel, EntityModelType } from '@companion-app/shared/Model/EntityModel.js'

export class EntityClipboardStore {
	protected _copiedEntity: SomeEntityModel | null = null

	constructor() {
		makeObservable<EntityClipboardStore, '_copiedEntity'>(this, {
			_copiedEntity: observable,
		})
	}

	get copiedEntity(): SomeEntityModel | null {
		return this._copiedEntity
	}

	get copiedEntityType(): EntityModelType | null {
		return this._copiedEntity?.type ?? null
	}

	copyEntity = action((entity: SomeEntityModel): void => {
		this._copiedEntity = structuredClone(entity)
	})

	clear = action((): void => {
		this._copiedEntity = null
	})
}
