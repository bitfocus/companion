import { CustomVariableDefinition, CustomVariableUpdate } from '@companion-app/shared/Model/CustomVariableModel.js'
import { ObservableMap, action, computed, observable } from 'mobx'
import { assertNever } from '~/util.js'
import {
	AllVariableDefinitions,
	VariableDefinition,
	VariableDefinitionUpdate,
} from '@companion-app/shared/Model/Variables.js'
import { applyPatch } from 'fast-json-patch'
import { cloneDeep } from 'lodash-es'

export class VariablesStore {
	readonly customVariables = observable.map<string, CustomVariableDefinition>()
	readonly variables = observable.map<string, ObservableMap<string, VariableDefinition>>()

	public resetCustomVariables = action((newData: Record<string, CustomVariableDefinition | undefined> | null): void => {
		this.customVariables.clear()

		if (newData) {
			for (const [id, item] of Object.entries(newData)) {
				if (item) {
					this.customVariables.set(id, item)
				}
			}
		}
	})

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

	public applyCustomVariablesChanges = action((changes: CustomVariableUpdate[]) => {
		for (const change of changes) {
			const changeType = change.type
			switch (change.type) {
				case 'update':
					this.customVariables.set(change.itemId, change.info)
					break
				case 'remove':
					this.customVariables.delete(change.itemId)
					break
				default:
					console.error(`Unknown custom variable change: ${changeType}`)
					assertNever(change)
					break
			}
		}
	})

	public applyVariablesChange = action((label: string, change: VariableDefinitionUpdate | null) => {
		if (change) {
			const changeType = change.type
			switch (change.type) {
				case 'set': {
					const variablesMap = this.variables.get(label) || observable.map<string, VariableDefinition>()

					for (const [name, info] of Object.entries(change.variables)) {
						if (info) variablesMap.set(name, info)
					}

					this.variables.set(label, variablesMap)
					break
				}
				case 'patch': {
					const oldObj = this.variables.get(label)
					if (!oldObj) throw new Error(`Got variables update for unknown instance: ${label}`)
					const newObj = applyPatch(cloneDeep(Object.fromEntries(oldObj.toJSON())), change.patch)
					oldObj.replace(newObj.newDocument)
					break
				}
				default:
					console.error(`Unknown custom variable change: ${changeType}`)
					assertNever(change)
					break
			}
		} else {
			this.variables.delete(label)
		}
	})

	public allVariableDefinitions = computed((): VariableDefinitionExt[] => {
		const definitions: VariableDefinitionExt[] = []

		// Module variables
		for (const label of this.variables.keys()) {
			definitions.push(...this.variableDefinitionsForLabel(label))
		}

		definitions.push(...this.customVariableDefinitions.get())

		return definitions
	})

	public customVariableDefinitions = computed((): VariableDefinitionExt[] => {
		const definitions: VariableDefinitionExt[] = []

		// Custom variables
		for (const [id, info] of this.customVariables) {
			definitions.push({
				label: info.description,
				connectionLabel: 'custom',
				name: id,
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
