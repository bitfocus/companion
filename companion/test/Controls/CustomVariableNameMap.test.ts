import { describe, test, expect, vi, beforeEach } from 'vitest'
import { CustomVariableNameMap } from '../../lib/Controls/CustomVariableNameMap.js'
import { ControlCustomVariable } from '../../lib/Controls/ControlTypes/CustomVariable.js'
import { mock } from 'vitest-mock-extended'
import type { VariablesValues } from '../../lib/Variables/Values.js'
import type { SomeControl } from '../../lib/Controls/IControlFragments.js'

// Mock VariablesValues with just the methods we need
const createMockVariablesValues = () => {
	return mock<VariablesValues>({
		setVariableValues: vi.fn(),
	})
}

// Mock ControlCustomVariable with minimal required properties
const createMockCustomVariable = (controlId: string, variableName: string): ControlCustomVariable => {
	const mockControl = mock<ControlCustomVariable>({
		controlId,
		options: { variableName },
		triggerRedraw: vi.fn() as any,
	})
	// Make the mock pass instanceof checks
	Object.setPrototypeOf(mockControl, ControlCustomVariable.prototype)
	return mockControl as ControlCustomVariable
}

// Mock other control types
const createMockOtherControl = (controlId: string) => {
	return mock<SomeControl<any>>({
		controlId,
	})
}

describe('CustomVariableNameMap', () => {
	let variableValuesController: VariablesValues
	let controls: Map<string, SomeControl<any>>
	let nameMap: CustomVariableNameMap

	beforeEach(() => {
		variableValuesController = createMockVariablesValues()
		controls = new Map()
		nameMap = new CustomVariableNameMap(variableValuesController, controls)
	})

	describe('getControlIdByName', () => {
		test('returns undefined for non-existent variable name', () => {
			expect(nameMap.getControlIdByName('nonexistent')).toBeUndefined()
		})

		test('returns active control id for existing variable name', () => {
			const control1 = createMockCustomVariable('control1', 'test_var')
			controls.set('control1', control1)

			nameMap.addCustomVariable('control1', 'test_var')

			expect(nameMap.getControlIdByName('test_var')).toBe('control1')
		})
	})

	describe('rebuildMap', () => {
		test('clears existing map and rebuilds from controls', () => {
			// Add some initial data
			nameMap.addCustomVariable('old_control', 'old_var')
			expect(nameMap.getControlIdByName('old_var')).toBe('old_control')

			// Add custom variable controls
			const control1 = createMockCustomVariable('control1', 'var1')
			const control2 = createMockCustomVariable('control2', 'var2')
			const control3 = createMockOtherControl('control3') // Not a custom variable

			controls.set('control1', control1)
			controls.set('control2', control2)
			controls.set('control3', control3)

			nameMap.rebuildMap()

			// Old variable should be gone
			expect(nameMap.getControlIdByName('old_var')).toBeUndefined()

			// New variables should be present
			expect(nameMap.getControlIdByName('var1')).toBe('control1')
			expect(nameMap.getControlIdByName('var2')).toBe('control2')
		})

		test('sorts controls by controlId for consistent conflict resolution', () => {
			// Create controls with same variable name but different controlIds
			const controlB = createMockCustomVariable('control_b', 'shared_var')
			const controlA = createMockCustomVariable('control_a', 'shared_var')
			const controlC = createMockCustomVariable('control_c', 'shared_var')

			controls.set('control_b', controlB)
			controls.set('control_a', controlA)
			controls.set('control_c', controlC)

			nameMap.rebuildMap()

			// control_a should be active (alphabetically first)
			expect(nameMap.getControlIdByName('shared_var')).toBe('control_a')
		})

		test('handles empty variable names gracefully', () => {
			const control1 = createMockCustomVariable('control1', '')
			const control2 = createMockCustomVariable('control2', 'valid_var')

			controls.set('control1', control1)
			controls.set('control2', control2)

			expect(() => nameMap.rebuildMap()).not.toThrow()

			expect(nameMap.getControlIdByName('')).toBeUndefined()
			expect(nameMap.getControlIdByName('valid_var')).toBe('control2')
		})
	})

	describe('addCustomVariable', () => {
		test('adds first control as active', () => {
			nameMap.addCustomVariable('control1', 'test_var')

			expect(nameMap.getControlIdByName('test_var')).toBe('control1')
		})

		test('adds subsequent controls as conflicts', () => {
			nameMap.addCustomVariable('control1', 'test_var')
			nameMap.addCustomVariable('control2', 'test_var')
			nameMap.addCustomVariable('control3', 'test_var')

			// First control should remain active
			expect(nameMap.getControlIdByName('test_var')).toBe('control1')
		})

		test('prevents duplicate control IDs in conflicts', () => {
			nameMap.addCustomVariable('control1', 'test_var')
			nameMap.addCustomVariable('control2', 'test_var')
			nameMap.addCustomVariable('control2', 'test_var') // Adding same control again

			expect(nameMap.getControlIdByName('test_var')).toBe('control1')
			// Should not have duplicates in the internal structure
		})
	})

	describe('removeCustomVariable', () => {
		test('removes active control and promotes next in line', () => {
			const control2 = createMockCustomVariable('control2', 'test_var')
			controls.set('control2', control2)

			nameMap.addCustomVariable('control1', 'test_var')
			nameMap.addCustomVariable('control2', 'test_var')
			nameMap.addCustomVariable('control3', 'test_var')

			expect(nameMap.getControlIdByName('test_var')).toBe('control1')

			// Remove active control
			nameMap.removeCustomVariable('control1', 'test_var')

			expect(nameMap.getControlIdByName('test_var')).toBe('control2')
			expect(control2.triggerRedraw).toHaveBeenCalled()
		})

		test('removes entry entirely when no other controls exist', () => {
			nameMap.addCustomVariable('control1', 'test_var')

			expect(nameMap.getControlIdByName('test_var')).toBe('control1')

			nameMap.removeCustomVariable('control1', 'test_var')

			expect(nameMap.getControlIdByName('test_var')).toBeUndefined()
			expect(variableValuesController.setVariableValues).toHaveBeenCalledWith('custom', [
				{ id: 'test_var', value: undefined },
			])
		})

		test('removes non-active control from conflicts list', () => {
			nameMap.addCustomVariable('control1', 'test_var')
			nameMap.addCustomVariable('control2', 'test_var')
			nameMap.addCustomVariable('control3', 'test_var')

			expect(nameMap.getControlIdByName('test_var')).toBe('control1')

			// Remove non-active control
			nameMap.removeCustomVariable('control2', 'test_var')

			// Active control should remain the same
			expect(nameMap.getControlIdByName('test_var')).toBe('control1')
		})

		test('handles non-existent variable name gracefully', () => {
			expect(() => nameMap.removeCustomVariable('control1', 'nonexistent')).not.toThrow()
		})

		test('handles non-existent control id gracefully', () => {
			nameMap.addCustomVariable('control1', 'test_var')

			expect(() => nameMap.removeCustomVariable('nonexistent', 'test_var')).not.toThrow()

			// Original control should still be active
			expect(nameMap.getControlIdByName('test_var')).toBe('control1')
		})

		test('ignores empty variable names', () => {
			expect(() => nameMap.removeCustomVariable('control1', '')).not.toThrow()
		})

		test('handles missing control when promoting new active control', () => {
			nameMap.addCustomVariable('control1', 'test_var')
			nameMap.addCustomVariable('control2', 'test_var')

			// control2 is not in the controls map, so triggerRedraw won't be called
			nameMap.removeCustomVariable('control1', 'test_var')

			expect(nameMap.getControlIdByName('test_var')).toBe('control2')
		})
	})

	describe('updateCustomVariableName', () => {
		test('moves control from old name to new name', () => {
			nameMap.addCustomVariable('control1', 'old_name')

			expect(nameMap.getControlIdByName('old_name')).toBe('control1')
			expect(nameMap.getControlIdByName('new_name')).toBeUndefined()

			nameMap.updateCustomVariableName('control1', 'old_name', 'new_name')

			expect(nameMap.getControlIdByName('old_name')).toBeUndefined()
			expect(nameMap.getControlIdByName('new_name')).toBe('control1')
		})

		test('handles conflicts when moving to existing name', () => {
			nameMap.addCustomVariable('control1', 'old_name')
			nameMap.addCustomVariable('control2', 'existing_name')

			nameMap.updateCustomVariableName('control1', 'old_name', 'existing_name')

			expect(nameMap.getControlIdByName('old_name')).toBeUndefined()
			expect(nameMap.getControlIdByName('existing_name')).toBe('control2') // existing control remains active
		})

		test('promotes next control when active control is renamed', () => {
			const control2 = createMockCustomVariable('control2', 'shared_name')
			controls.set('control2', control2)

			nameMap.addCustomVariable('control1', 'shared_name')
			nameMap.addCustomVariable('control2', 'shared_name')

			expect(nameMap.getControlIdByName('shared_name')).toBe('control1')

			nameMap.updateCustomVariableName('control1', 'shared_name', 'new_name')

			expect(nameMap.getControlIdByName('shared_name')).toBe('control2')
			expect(nameMap.getControlIdByName('new_name')).toBe('control1')
			expect(control2.triggerRedraw).toHaveBeenCalled()
		})
	})

	describe('isCustomVariableActive', () => {
		test('returns false for non-existent control', () => {
			expect(nameMap.isCustomVariableActive('nonexistent')).toBe(false)
		})

		test('returns false for non-custom-variable control', () => {
			const otherControl = createMockOtherControl('control1')
			controls.set('control1', otherControl)

			expect(nameMap.isCustomVariableActive('control1')).toBe(false)
		})

		test('returns false for custom variable with empty name', () => {
			const control = createMockCustomVariable('control1', '')
			controls.set('control1', control)

			expect(nameMap.isCustomVariableActive('control1')).toBe(false)
		})

		test('returns true for active custom variable', () => {
			const control = createMockCustomVariable('control1', 'test_var')
			controls.set('control1', control)

			nameMap.addCustomVariable('control1', 'test_var')

			expect(nameMap.isCustomVariableActive('control1')).toBe(true)
		})

		test('returns false for non-active custom variable in conflict', () => {
			const control1 = createMockCustomVariable('control1', 'test_var')
			const control2 = createMockCustomVariable('control2', 'test_var')
			controls.set('control1', control1)
			controls.set('control2', control2)

			nameMap.addCustomVariable('control1', 'test_var')
			nameMap.addCustomVariable('control2', 'test_var')

			expect(nameMap.isCustomVariableActive('control1')).toBe(true)
			expect(nameMap.isCustomVariableActive('control2')).toBe(false)
		})

		test('returns false when variable name not in map', () => {
			const control = createMockCustomVariable('control1', 'unmapped_var')
			controls.set('control1', control)

			expect(nameMap.isCustomVariableActive('control1')).toBe(false)
		})
	})

	describe('integration scenarios', () => {
		test('handles complete lifecycle of conflicting variables', () => {
			const control1 = createMockCustomVariable('control1', 'shared_var')
			const control2 = createMockCustomVariable('control2', 'shared_var')
			const control3 = createMockCustomVariable('control3', 'shared_var')

			controls.set('control1', control1)
			controls.set('control2', control2)
			controls.set('control3', control3)

			// Add variables in order
			nameMap.addCustomVariable('control1', 'shared_var')
			nameMap.addCustomVariable('control2', 'shared_var')
			nameMap.addCustomVariable('control3', 'shared_var')

			expect(nameMap.getControlIdByName('shared_var')).toBe('control1')
			expect(nameMap.isCustomVariableActive('control1')).toBe(true)
			expect(nameMap.isCustomVariableActive('control2')).toBe(false)
			expect(nameMap.isCustomVariableActive('control3')).toBe(false)

			// Remove active control
			nameMap.removeCustomVariable('control1', 'shared_var')

			expect(nameMap.getControlIdByName('shared_var')).toBe('control2')
			expect(nameMap.isCustomVariableActive('control2')).toBe(true)
			expect(nameMap.isCustomVariableActive('control3')).toBe(false)
			expect(control2.triggerRedraw).toHaveBeenCalled()

			// Remove another control
			nameMap.removeCustomVariable('control2', 'shared_var')

			expect(nameMap.getControlIdByName('shared_var')).toBe('control3')
			expect(nameMap.isCustomVariableActive('control3')).toBe(true)
			expect(control3.triggerRedraw).toHaveBeenCalled()

			// Remove last control
			nameMap.removeCustomVariable('control3', 'shared_var')

			expect(nameMap.getControlIdByName('shared_var')).toBeUndefined()
			expect(variableValuesController.setVariableValues).toHaveBeenCalledWith('custom', [
				{ id: 'shared_var', value: undefined },
			])
		})

		test('handles rebuild with existing conflicts', () => {
			// Manually add conflicts
			nameMap.addCustomVariable('control2', 'shared_var')
			nameMap.addCustomVariable('control1', 'shared_var')
			nameMap.addCustomVariable('control3', 'shared_var')

			expect(nameMap.getControlIdByName('shared_var')).toBe('control2') // first added

			// Add controls to map for rebuild
			const control1 = createMockCustomVariable('control1', 'shared_var')
			const control2 = createMockCustomVariable('control2', 'shared_var')
			const control3 = createMockCustomVariable('control3', 'shared_var')

			controls.set('control1', control1)
			controls.set('control2', control2)
			controls.set('control3', control3)

			// Rebuild should sort by controlId
			nameMap.rebuildMap()

			expect(nameMap.getControlIdByName('shared_var')).toBe('control1') // alphabetically first
		})

		test('handles mixed add/remove/update operations correctly', () => {
			const control1 = createMockCustomVariable('control1', 'var1')
			const control2 = createMockCustomVariable('control2', 'var2')

			controls.set('control1', control1)
			controls.set('control2', control2)

			// Add initial variables
			nameMap.addCustomVariable('control1', 'var1')
			nameMap.addCustomVariable('control2', 'var2')

			expect(nameMap.getControlIdByName('var1')).toBe('control1')
			expect(nameMap.getControlIdByName('var2')).toBe('control2')

			// Update control1 to same name as control2 (creates conflict)
			nameMap.updateCustomVariableName('control1', 'var1', 'var2')

			expect(nameMap.getControlIdByName('var1')).toBeUndefined()
			expect(nameMap.getControlIdByName('var2')).toBe('control2') // control2 remains active
			expect(nameMap.isCustomVariableActive('control1')).toBe(false)
			expect(nameMap.isCustomVariableActive('control2')).toBe(true)

			// Remove active control2
			control1.options.variableName = 'var2' // update mock for isCustomVariableActive check
			nameMap.removeCustomVariable('control2', 'var2')

			expect(nameMap.getControlIdByName('var2')).toBe('control1') // control1 becomes active
			expect(nameMap.isCustomVariableActive('control1')).toBe(true)
			expect(control1.triggerRedraw).toHaveBeenCalled()
		})

		test('handles edge case with null/undefined variable names in options', () => {
			const controlWithNullName = createMockCustomVariable('control1', '')
			controlWithNullName.options.variableName = null as any

			const controlWithUndefinedName = createMockCustomVariable('control2', '')
			controlWithUndefinedName.options.variableName = undefined as any

			controls.set('control1', controlWithNullName)
			controls.set('control2', controlWithUndefinedName)

			expect(() => nameMap.rebuildMap()).not.toThrow()
			expect(nameMap.isCustomVariableActive('control1')).toBe(false)
			expect(nameMap.isCustomVariableActive('control2')).toBe(false)
		})
	})
})
