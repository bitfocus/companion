import type { ClientEventDefinition } from '@companion-app/shared/Model/Common.js'
import { action, makeObservable, observable } from 'mobx'

export class EventDefinitionsStore {
	private definitions_: Record<string, ClientEventDefinition | undefined> = {}

	constructor() {
		makeObservable<EventDefinitionsStore, 'definitions_'>(this, {
			definitions_: observable,
		})
	}

	get definitions(): Record<string, ClientEventDefinition | undefined> {
		return this.definitions_
	}

	public setDefinitions = action((definitions: Record<string, ClientEventDefinition | undefined>) => {
		this.definitions_ = definitions
	})
}
