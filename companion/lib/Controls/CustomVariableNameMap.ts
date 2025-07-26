import type { VariablesValues } from '../Variables/Values.js'
import { ControlCustomVariable } from './ControlTypes/CustomVariable.js'
import type { SomeControl } from './IControlFragments.js'

export class CustomVariableNameMap {
	/**
	 * Map to track custom variable naming conflicts
	 * Key: variableName, Value: { activeControlId, otherControlIds[] }
	 */
	readonly #customVariableNamesMap = new Map<string, { activeControlId: string; otherControlIds: string[] }>()

	readonly #variableValuesController: VariablesValues
	readonly #controls: Map<string, SomeControl<any>>

	constructor(variableValuesController: VariablesValues, controls: Map<string, SomeControl<any>>) {
		this.#variableValuesController = variableValuesController
		this.#controls = controls
	}

	getControlIdByName(name: string): string | undefined {
		const nameEntry = this.#customVariableNamesMap.get(name)
		return nameEntry?.activeControlId
	}

	/**
	 * Rebuild the custom variable names map from all current custom variables
	 */
	rebuildMap(): void {
		this.#customVariableNamesMap.clear()

		const allCustomVariables: ControlCustomVariable[] = []
		for (const control of this.#controls.values()) {
			if (control instanceof ControlCustomVariable) {
				allCustomVariables.push(control)
			}
		}

		// Sort by controlId to ensure consistent order in conflicts
		allCustomVariables.sort((a, b) => a.controlId.localeCompare(b.controlId))

		for (const control of allCustomVariables) {
			this.addCustomVariable(control.controlId, control.options.variableName)
		}
	}

	/**
	 * Add a custom variable to the names map
	 */
	addCustomVariable(controlId: string, variableName: string): void {
		if (!variableName || variableName.length === 0) return

		const existing = this.#customVariableNamesMap.get(variableName)
		if (existing) {
			// Variable name already exists, add to conflicts if not already present
			if (!existing.otherControlIds.includes(controlId) && existing.activeControlId !== controlId) {
				existing.otherControlIds.push(controlId)
			}
		} else {
			// First control with this name becomes active
			this.#customVariableNamesMap.set(variableName, {
				activeControlId: controlId,
				otherControlIds: [],
			})
		}
	}

	/**
	 * Remove a custom variable from the names map
	 */
	removeCustomVariable(controlId: string, variableName: string): void {
		if (!variableName || variableName.length === 0) return

		const existing = this.#customVariableNamesMap.get(variableName)
		if (!existing) return

		if (existing.activeControlId === controlId) {
			// Active control is being removed
			if (existing.otherControlIds.length > 0) {
				// Promote the first other control to active
				const newActiveControlId = existing.otherControlIds.shift()!
				existing.activeControlId = newActiveControlId

				// Invalidate the newly promoted control so it updates its variable value
				const newActiveControl = this.#controls.get(newActiveControlId) as ControlCustomVariable | undefined
				if (newActiveControl) {
					newActiveControl.triggerRedraw()
				}
			} else {
				// No other controls, remove the entry entirely
				this.#customVariableNamesMap.delete(variableName)

				// Clear cached values
				this.#variableValuesController.setVariableValues('custom', [{ id: variableName, value: undefined }])
			}
		} else {
			// Non-active control is being removed, just remove from others list
			const index = existing.otherControlIds.indexOf(controlId)
			if (index >= 0) {
				existing.otherControlIds.splice(index, 1)
			}
		}
	}

	/**
	 * Update custom variable name in the map when a control's variableName changes
	 */
	updateCustomVariableName(controlId: string, oldVariableName: string, newVariableName: string): void {
		// Remove from old name
		this.removeCustomVariable(controlId, oldVariableName)

		// Add to new name
		this.addCustomVariable(controlId, newVariableName)
	}

	/**
	 * Check if a custom variable control is the active one for its variableName
	 */
	isCustomVariableActive(controlId: string): boolean {
		const control = this.#controls.get(controlId) as ControlCustomVariable | undefined
		if (!control || !control.options.variableName) return false

		const nameEntry = this.#customVariableNamesMap.get(control.options.variableName)
		return nameEntry?.activeControlId === controlId
	}
}
