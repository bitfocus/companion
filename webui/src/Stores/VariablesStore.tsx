import type {
	CustomVariableCollection,
	CustomVariableDefinition,
	CustomVariableUpdate,
} from '@companion-app/shared/Model/CustomVariableModel.js'
import { ObservableMap, action, computed, observable } from 'mobx'
import { assertNever } from '~/util.js'
import type { VariableDefinition, VariableDefinitionUpdate } from '@companion-app/shared/Model/Variables.js'
import { applyPatch } from 'fast-json-patch'
import { cloneDeep } from 'lodash-es'

export class VariablesStore {
	readonly customVariables = observable.map<string, CustomVariableDefinition>()
	readonly variables = observable.map<string, ObservableMap<string, VariableDefinition>>()
	readonly customVariableCollections = observable.map<string, CustomVariableCollection>()

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

	public get allCustomVariableCollectionIds(): string[] {
		const collectionIds: string[] = []

		const collectCollectionIds = (collections: Iterable<CustomVariableCollection>): void => {
			for (const collection of collections || []) {
				collectionIds.push(collection.id)
				collectCollectionIds(collection.children)
			}
		}

		collectCollectionIds(this.customVariableCollections.values())

		return collectionIds
	}

	public rootCustomVariableCollections(): CustomVariableCollection[] {
		return Array.from(this.customVariableCollections.values()).sort((a, b) => a.sortOrder - b.sortOrder)
	}

	public resetCustomVariableCollections = action((newData: CustomVariableCollection[] | null) => {
		this.customVariableCollections.clear()

		if (newData) {
			for (const collection of newData) {
				if (!collection) continue

				this.customVariableCollections.set(collection.id, collection)
			}
		}
	})
}

export interface VariableDefinitionExt extends VariableDefinition {
	connectionLabel: string
	name: string
}
