import { action, makeObservable, observable } from 'mobx'
import type { UserConfigModel, UserConfigUpdate } from '@companion-app/shared/Model/UserConfigModel.js'
import { assertNever } from '~/Resources/util'

function setUserConfigValue<K extends keyof UserConfigModel>(
	config: UserConfigModel,
	key: K,
	value: UserConfigModel[K]
): void {
	config[key] = value
}

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
				this.properties_ = structuredClone(change.config)
				break
			case 'key':
				setUserConfigValue(this.properties_, change.key, change.value)
				break

			default:
				assertNever(change)
				break
		}
	})
}
