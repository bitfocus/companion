import { action, makeObservable, observable } from 'mobx'

export class ViewControlStore {
	protected _buttonGridHotPress: boolean = false

	constructor() {
		makeObservable<ViewControlStore, '_buttonGridHotPress'>(this, {
			_buttonGridHotPress: observable,
		})
	}

	get buttonGridHotPress(): boolean {
		return this._buttonGridHotPress
	}

	setButtonGridHotPress = action((hotPress: boolean): void => {
		this._buttonGridHotPress = hotPress
	})
}
