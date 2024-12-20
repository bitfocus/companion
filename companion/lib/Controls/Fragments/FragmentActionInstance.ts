import type { ActionDefinition } from '@companion-app/shared/Model/ActionDefinitionModel.js'
import type { ActionInstance } from '@companion-app/shared/Model/ActionModel.js'

export class FragmentActionInstance {
	readonly #data: Omit<ActionInstance, 'children'>

	get disabled(): boolean {
		return !!this.#data.disabled
	}

	/**
	 * Get the id of the connection this action belongs to
	 */
	get connectionId(): string {
		return this.#data.instance
	}

	/**
	 * Get a reference to the options for this action
	 * Note: This must not be a copy, but the raw object
	 */
	get rawOptions() {
		return this.#data.options
	}

	/**
	 * Get the definition for this action
	 */
	getDefinition(): ActionDefinition | undefined {
		return this.#instanceDefinitions.getActionDefinition(this.#data.instance, this.#data.action)
	}

	/**
	 * Replace portions of the action with an updated version
	 */
	replaceProps(newProps: Pick<ActionInstance, 'action' | 'options'>, skipNotifyModule = false): void {
		this.#data.action = newProps.action // || newProps.actionId
		this.#data.options = newProps.options

		delete this.#data.upgradeIndex

		if (!skipNotifyModule) {
			this.subscribe(false)
		}
	}
}
