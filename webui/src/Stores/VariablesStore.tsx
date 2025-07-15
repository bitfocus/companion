import { ObservableMap, action, computed, observable } from 'mobx'
import { assertNever } from '~/util.js'
import type {
	AllVariableDefinitions,
	VariableDefinition,
	VariableDefinitionUpdate,
} from '@companion-app/shared/Model/Variables.js'
import { applyPatch } from 'fast-json-patch'
import { cloneDeep } from 'lodash-es'
import { CustomVariablesListStore } from './CustomVariablesListStore'

export class VariablesStore {
	readonly #customVariables: CustomVariablesListStore

	readonly variables = observable.map<string, ObservableMap<string, VariableDefinition>>()

	constructor(customVariables: CustomVariablesListStore) {
		this.#customVariables = customVariables
	}

	public resetVariables = action((newData: AllVariableDefinitions | null): void => {
		this.variables.clear()

		if (newData) {
			for (const [label, variables] of Object.entries(newData)) {
				if (!variables) continue

				const newVariables = observable.map<string, VariableDefinition>()

				for (const [name, variable] of Object.entries(variables)) {
					if (!variable) continue

					newVariables.set(name, variable)
				}

				this.variables.set(label, newVariables)
			}
		}
	})

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
				const variablesMap = this.variables.get(change.label) || observable.map<string, VariableDefinition>()

				for (const [name, info] of Object.entries(change.variables)) {
					if (info) variablesMap.set(name, info)
				}

				this.variables.set(change.label, variablesMap)
				break
			}
			case 'patch': {
				const oldObj = this.variables.get(change.label)
				if (!oldObj) throw new Error(`Got variables update for unknown instance: ${change.label}`)
				const newObj = applyPatch(cloneDeep(Object.fromEntries(oldObj.toJSON())), change.patch)
				oldObj.replace(newObj.newDocument)
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
