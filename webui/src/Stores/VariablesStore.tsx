import { ObservableMap, action, computed, observable } from 'mobx'
import { assertNever } from '~/Resources/util.js'
import type { VariableDefinition, VariableDefinitionUpdate } from '@companion-app/shared/Model/Variables.js'
import { ApplyDiffToStore, updateObjectInPlace } from './ApplyDiffToMap'
import type { CustomVariablesListStore } from './CustomVariablesListStore'

export class VariablesStore {
	readonly #customVariables: CustomVariablesListStore

	readonly variables = observable.map<string, ObservableMap<string, VariableDefinition>>()

	constructor(customVariables: CustomVariablesListStore) {
		this.#customVariables = customVariables
	}

	public updateDefinitions = action((change: VariableDefinitionUpdate | null) => {
		if (!change) {
			this.variables.clear()
			return
		}

		const changeType = change.type
		switch (change.type) {
			case 'init': {
				this.variables.clear()
				for (const [label, variables] of Object.entries(change.variables)) {
					if (variables) {
						const variablesMap = observable.map<string, VariableDefinition>()
						for (const [name, info] of Object.entries(variables)) {
							if (info) variablesMap.set(name, info)
						}
						this.variables.set(label, variablesMap)
					}
				}
				break
			}
			case 'set': {
				let variablesMap = this.variables.get(change.label)
				if (!variablesMap) {
					variablesMap = observable.map<string, VariableDefinition>()
					this.variables.set(change.label, variablesMap)
				}

				for (const [name, info] of Object.entries(change.variables)) {
					if (info) {
						const existing = variablesMap.get(name)
						if (existing) {
							updateObjectInPlace(existing, info)
						} else {
							variablesMap.set(name, info)
						}
					}
				}

				break
			}
			case 'patch': {
				const oldObj = this.variables.get(change.label)
				if (!oldObj) throw new Error(`Got variables update for unknown instance: ${change.label}`)
				ApplyDiffToStore(oldObj, change)
				break
			}
			case 'remove': {
				this.variables.delete(change.label)
				break
			}
			default:
				console.error(`Unknown custom variable change: ${changeType}`)
				assertNever(change)
				break
		}
	})

	public allVariableDefinitions = computed((): VariableDefinitionExt[] => {
		const definitions: VariableDefinitionExt[] = []

		// Module variables
		for (const label of this.variables.keys()) {
			definitions.push(...this.variableDefinitionsForLabel(label))
		}

		// Custom variables
		for (const info of this.#customVariables.customVariables.values()) {
			if (!info.variableName) continue

			definitions.push({
				label: info.description || 'A custom variable',
				connectionLabel: 'custom',
				name: info.variableName,
			})
		}

		return definitions
	})

	public variableDefinitionsForLabel = (label: string): VariableDefinitionExt[] => {
		const definitions: VariableDefinitionExt[] = []

		// Module variables
		const variables = this.variables.get(label)
		if (variables) {
			for (const [name, variable] of variables) {
				definitions.push({
					...variable,
					connectionLabel: label,
					name,
				})
			}
		}

		return definitions
	}
}

export interface VariableDefinitionExt extends VariableDefinition {
	connectionLabel: string
	name: string
}
