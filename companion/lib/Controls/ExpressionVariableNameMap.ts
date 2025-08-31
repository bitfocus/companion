import type { VariablesValues } from '../Variables/Values.js'
import { ControlExpressionVariable } from './ControlTypes/ExpressionVariable.js'
import type { SomeControl } from './IControlFragments.js'

export class ExpressionVariableNameMap {
	/**
	 * Map to track expression variable naming conflicts
	 * Key: variableName, Value: { activeControlId, otherControlIds[] }
	 */
	readonly #expressionVariableNamesMap = new Map<string, { activeControlId: string; otherControlIds: string[] }>()

	readonly #variableValuesController: VariablesValues
	readonly #controls: Map<string, SomeControl<any>>

	constructor(variableValuesController: VariablesValues, controls: Map<string, SomeControl<any>>) {
		this.#variableValuesController = variableValuesController
		this.#controls = controls
	}

	getControlIdByName(name: string): string | undefined {
		const nameEntry = this.#expressionVariableNamesMap.get(name)
		return nameEntry?.activeControlId
	}

	/**
	 * Rebuild the expression variable names map from all current expression variables
	 */
	rebuildMap(): void {
		this.#expressionVariableNamesMap.clear()

		const allExpressionVariables: ControlExpressionVariable[] = []
		for (const control of this.#controls.values()) {
			if (control instanceof ControlExpressionVariable) {
				allExpressionVariables.push(control)
			}
		}

		// Sort by controlId to ensure consistent order in conflicts
		allExpressionVariables.sort((a, b) => a.controlId.localeCompare(b.controlId))

		for (const control of allExpressionVariables) {
			this.addExpressionVariable(control.controlId, control.options.variableName)
		}
	}

	/**
	 * Add an expression variable to the names map
	 */
	addExpressionVariable(controlId: string, variableName: string): void {
		if (!variableName || variableName.length === 0) return

		const existing = this.#expressionVariableNamesMap.get(variableName)
		if (existing) {
			// Variable name already exists, add to conflicts if not already present
			if (!existing.otherControlIds.includes(controlId) && existing.activeControlId !== controlId) {
				existing.otherControlIds.push(controlId)
			}
		} else {
			// First control with this name becomes active
			this.#expressionVariableNamesMap.set(variableName, {
				activeControlId: controlId,
				otherControlIds: [],
			})
		}
	}

	/**
	 * Remove an expression variable from the names map
	 */
	removeExpressionVariable(controlId: string, variableName: string): void {
		if (!variableName || variableName.length === 0) return

		const existing = this.#expressionVariableNamesMap.get(variableName)
		if (!existing) return

		if (existing.activeControlId === controlId) {
			// Active control is being removed
			if (existing.otherControlIds.length > 0) {
				// Promote the first other control to active
				const newActiveControlId = existing.otherControlIds.shift()!
				existing.activeControlId = newActiveControlId

				// Invalidate the newly promoted control so it updates its variable value
				const newActiveControl = this.#controls.get(newActiveControlId) as ControlExpressionVariable | undefined
				if (newActiveControl) {
					newActiveControl.triggerRedraw()
				}
			} else {
				// No other controls, remove the entry entirely
				this.#expressionVariableNamesMap.delete(variableName)

				// Clear cached values
				this.#variableValuesController.setVariableValues('expression', [{ id: variableName, value: undefined }])
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
	 * Update expression variable name in the map when a control's variableName changes
	 */
	updateExpressionVariableName(controlId: string, oldVariableName: string, newVariableName: string): void {
		// Remove from old name
		this.removeExpressionVariable(controlId, oldVariableName)

		// Add to new name
		this.addExpressionVariable(controlId, newVariableName)
	}

	/**
	 * Check if an expression variable control is the active one for its variableName
	 */
	isExpressionVariableActive(controlId: string): boolean {
		const control = this.#controls.get(controlId) as ControlExpressionVariable | undefined
		if (!control || !control.options.variableName) return false

		const nameEntry = this.#expressionVariableNamesMap.get(control.options.variableName)
		return nameEntry?.activeControlId === controlId
	}
}
