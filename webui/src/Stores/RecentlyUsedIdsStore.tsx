import { action, observable, type IObservableArray } from 'mobx'

export class RecentlyUsedIdsStore {
	readonly #localStorageKey: string
	readonly #targetLength: number

	readonly recentIds: IObservableArray<string>

	constructor(localStorageKey: string, targetLength: number) {
		this.#localStorageKey = localStorageKey
		this.#targetLength = targetLength

		let initialValue: string[] = []
		try {
			// Try to load from storage, ignoring any errors
			const loadedValue = JSON.parse(window.localStorage.getItem('recent_actions') || '[]')
			if (Array.isArray(loadedValue)) initialValue = loadedValue
		} catch (_e) {
			// Ignore
		}

		this.recentIds = observable.array<string>(initialValue)
	}

	trackId = action((id: string): void => {
		// Ensure not already in the array
		this.recentIds.remove(id)

		// Add to the start of the array
		const newLength = this.recentIds.unshift(id)

		// Cap length
		this.recentIds.splice(this.#targetLength, newLength - this.#targetLength)

		// Update storage
		window.localStorage.setItem(this.#localStorageKey, JSON.stringify(this.recentIds.toJSON()))
	})
}
