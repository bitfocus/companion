import { action, makeObservable, observable } from 'mobx'
import { cloneDeep } from 'lodash-es'
import { UserConfigModel, UserConfigUpdate } from '@companion-app/shared/Model/UserConfigModel.js'
import { assertNever } from '~/util'

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

	public updateStore = action((change: UserConfigUpdate | null) => {
		if (!change) {
			this.hasProperties_ = false
			this.properties_ = {} as any
			return
		}

		switch (change.type) {
			case 'init':
				this.hasProperties_ = true
				this.properties_ = cloneDeep(change.config)
				break
			case 'key':
				;(this.properties_ as any)[change.key] = change.value
				break

			default:
				assertNever(change)
				break
		}
	})
}
