import type { ClientEventDefinition } from '@companion-app/shared/Model/Common.js'
import { action, observable } from 'mobx'

export class EventDefinitionsStore {
	public readonly definitions = observable.map<string, ClientEventDefinition>()

	public setDefinitions = action((definitions: Record<string, ClientEventDefinition> | undefined) => {
		this.definitions.replace(definitions || {})
	})
}
