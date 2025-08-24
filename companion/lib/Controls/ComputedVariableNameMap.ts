import type { VariablesValues } from '../Variables/Values.js'
import { ControlComputedVariable } from './ControlTypes/ComputedVariable.js'
import type { SomeControl } from './IControlFragments.js'

export class ComputedVariableNameMap {
	/**
	 * Map to track computed variable naming conflicts
	 * Key: variableName, Value: { activeControlId, otherControlIds[] }
	 */
	readonly #computedVariableNamesMap = new Map<string, { activeControlId: string; otherControlIds: string[] }>()

	readonly #variableValuesController: VariablesValues
	readonly #controls: Map<string, SomeControl<any>>

	constructor(variableValuesController: VariablesValues, controls: Map<string, SomeControl<any>>) {
		this.#variableValuesController = variableValuesController
		this.#controls = controls
	}

	getControlIdByName(name: string): string | undefined {
		const nameEntry = this.#computedVariableNamesMap.get(name)
		return nameEntry?.activeControlId
	}

	/**
	 * Rebuild the computed variable names map from all current computed variables
	 */
	rebuildMap(): void {
		this.#computedVariableNamesMap.clear()

		const allComputedVariables: ControlComputedVariable[] = []
		for (const control of this.#controls.values()) {
			if (control instanceof ControlComputedVariable) {
				allComputedVariables.push(control)
			}
		}

		// Sort by controlId to ensure consistent order in conflicts
		allComputedVariables.sort((a, b) => a.controlId.localeCompare(b.controlId))

		for (const control of allComputedVariables) {
			this.addComputedVariable(control.controlId, control.options.variableName)
		}
	}

	/**
	 * Add a computed variable to the names map
	 */
	addComputedVariable(controlId: string, variableName: string): void {
		if (!variableName || variableName.length === 0) return

		const existing = this.#computedVariableNamesMap.get(variableName)
		if (existing) {
			// Variable name already exists, add to conflicts if not already present
			if (!existing.otherControlIds.includes(controlId) && existing.activeControlId !== controlId) {
				existing.otherControlIds.push(controlId)
			}
		} else {
			// First control with this name becomes active
			this.#computedVariableNamesMap.set(variableName, {
				activeControlId: controlId,
				otherControlIds: [],
			})
		}
	}

	/**
	 * Remove a computed variable from the names map
	 */
	removeComputedVariable(controlId: string, variableName: string): void {
		if (!variableName || variableName.length === 0) return

		const existing = this.#computedVariableNamesMap.get(variableName)
		if (!existing) return

		if (existing.activeControlId === controlId) {
			// Active control is being removed
			if (existing.otherControlIds.length > 0) {
				// Promote the first other control to active
				const newActiveControlId = existing.otherControlIds.shift()!
				existing.activeControlId = newActiveControlId

				// Invalidate the newly promoted control so it updates its variable value
				const newActiveControl = this.#controls.get(newActiveControlId) as ControlComputedVariable | undefined
				if (newActiveControl) {
					newActiveControl.triggerRedraw()
				}
			} else {
				// No other controls, remove the entry entirely
				this.#computedVariableNamesMap.delete(variableName)

				// Clear cached values
				this.#variableValuesController.setVariableValues('computed', [{ id: variableName, value: undefined }])
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
	 * Update computed variable name in the map when a control's variableName changes
	 */
	updateComputedVariableName(controlId: string, oldVariableName: string, newVariableName: string): void {
		// Remove from old name
		this.removeComputedVariable(controlId, oldVariableName)

		// Add to new name
		this.addComputedVariable(controlId, newVariableName)
	}

	/**
	 * Check if a computed variable control is the active one for its variableName
	 */
	isComputedVariableActive(controlId: string): boolean {
		const control = this.#controls.get(controlId) as ControlComputedVariable | undefined
		if (!control || !control.options.variableName) return false

		const nameEntry = this.#computedVariableNamesMap.get(control.options.variableName)
		return nameEntry?.activeControlId === controlId
	}
}
