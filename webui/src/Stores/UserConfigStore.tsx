import { action, makeObservable, observable } from 'mobx'
import { cloneDeep } from 'lodash-es'
import { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'

export class UserConfigStore {
	private hasProperties_ = false // properties_ can't be null, so we need a separate flag to check if it's initialized
	private properties_ = observable.object<UserConfigModel>({} as any)

	constructor() {
		makeObservable<UserConfigStore, 'hasProperties_' | 'properties_'>(this, {
			hasProperties_: observable,
			properties_: observable,
		})
	}

	get properties(): UserConfigModel | null {
		if (!this.hasProperties_) return null
		// if (!this.properties_) throw new Error('UserConfigStore not initialized')
		return this.properties_
	}

	public reset = action((newData: UserConfigModel | null): void => {
		if (newData) {
			this.hasProperties_ = true
			this.properties_ = cloneDeep(newData)
		} else {
			this.hasProperties_ = false
			this.properties_ = {} as any
		}
	})

	public updateStoreValue = action((key: keyof UserConfigModel, value: any): void => {
		;(this.properties_ as any)[key] = value
	})
}
