import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { BANNED_PROPS } from '@companion-app/shared/Expression/ExpressionResolve.js'
import { VARIABLE_UNKNOWN_VALUE } from '@companion-app/shared/Variables.js'
import type { VariablesCache } from '../../lib/Variables/Util.js'
import { VariablesValues, type VariableValueEntry } from '../../lib/Variables/Values.js'

describe('VariablesValues', () => {
	let values: VariablesValues

	beforeEach(() => {
		vi.useFakeTimers()
		values = new VariablesValues()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	function entry(id: string, value: VariableValueEntry['value']): VariableValueEntry {
		return { id, value }
	}

	describe('getVariableValue', () => {
		test('returns the value for an existing variable', () => {
			values.setVariableValues('conn', [entry('v', 'hello')])
			expect(values.getVariableValue('conn', 'v')).toBe('hello')
		})

		test('returns undefined for a non-existent label', () => {
			expect(values.getVariableValue('nonexistent', 'v')).toBeUndefined()
		})

		test('returns undefined for a non-existent variable in a known label', () => {
			values.setVariableValues('conn', [entry('v', 'hello')])
			expect(values.getVariableValue('conn', 'missing')).toBeUndefined()
		})

		test('redirects getVariableValue("internal", "custom_foo") to custom:foo', () => {
			values.setVariableValues('custom', [entry('foo', 'bar')])
			expect(values.getVariableValue('internal', 'custom_foo')).toBe('bar')
		})

		test('does not redirect internal variables that do not start with "custom_"', () => {
			values.setVariableValues('internal', [entry('notcustom_foo', 'bar')])
			// Should read from internal directly, NOT redirect to custom
			expect(values.getVariableValue('internal', 'notcustom_foo')).toBe('bar')
		})

		test('handles numeric values', () => {
			values.setVariableValues('conn', [entry('n', 42)])
			expect(values.getVariableValue('conn', 'n')).toBe(42)
		})

		test('handles boolean values', () => {
			values.setVariableValues('conn', [entry('b', false)])
			expect(values.getVariableValue('conn', 'b')).toBe(false)
		})

		test('handles null values', () => {
			values.setVariableValues('conn', [entry('n', null)])
			expect(values.getVariableValue('conn', 'n')).toBeNull()
		})
	})

	describe('getCustomVariableValue', () => {
		test('returns the value from the "custom" label', () => {
			values.setVariableValues('custom', [entry('myvar', 'hello')])
			expect(values.getCustomVariableValue('myvar')).toBe('hello')
		})

		test('returns undefined when the custom variable does not exist', () => {
			expect(values.getCustomVariableValue('missing')).toBeUndefined()
		})

		test('is equivalent to getVariableValue("custom", name)', () => {
			values.setVariableValues('custom', [entry('x', 99)])
			expect(values.getCustomVariableValue('x')).toBe(values.getVariableValue('custom', 'x'))
		})
	})

	describe('setVariableValues', () => {
		test('stores a new variable accessible via getVariableValue', () => {
			values.setVariableValues('conn', [entry('v', 'hello')])
			expect(values.getVariableValue('conn', 'v')).toBe('hello')
		})

		test('updates an existing variable to a new value', () => {
			values.setVariableValues('conn', [entry('v', 'old')])
			values.setVariableValues('conn', [entry('v', 'new')])
			expect(values.getVariableValue('conn', 'v')).toBe('new')
		})

		test('emits variables_changed with the correct changed ID and label', () => {
			const listener = vi.fn()
			values.on('variables_changed', listener)

			values.setVariableValues('conn', [entry('v', 'hello')])

			expect(listener).toHaveBeenCalledOnce()
			const [changedSet, labelsSet] = listener.mock.calls[0] as [ReadonlySet<string>, ReadonlySet<string>]
			expect(changedSet.has('conn:v')).toBe(true)
			expect(labelsSet.has('conn')).toBe(true)
		})

		test('does not emit variables_changed when the value has not changed', () => {
			values.setVariableValues('conn', [entry('v', 'same')])
			const listener = vi.fn()
			values.on('variables_changed', listener)

			values.setVariableValues('conn', [entry('v', 'same')])

			expect(listener).not.toHaveBeenCalled()
		})

		test('does not emit variables_changed for an empty variables array', () => {
			const listener = vi.fn()
			values.on('variables_changed', listener)

			values.setVariableValues('conn', [])

			expect(listener).not.toHaveBeenCalled()
		})

		test('only includes changed variables in the emitted set', () => {
			values.setVariableValues('conn', [entry('a', 1), entry('b', 2)])
			const listener = vi.fn()
			values.on('variables_changed', listener)

			values.setVariableValues('conn', [entry('a', 1), entry('b', 99)]) // only b changes

			const [changedSet] = listener.mock.calls[0] as [ReadonlySet<string>]
			expect(changedSet.has('conn:a')).toBe(false)
			expect(changedSet.has('conn:b')).toBe(true)
		})

		test('silently skips BANNED_PROPS and does not store them', () => {
			const banned = [...BANNED_PROPS][0]!
			const listener = vi.fn()
			values.on('variables_changed', listener)

			values.setVariableValues('conn', [entry(banned, 'evil')])

			expect(listener).not.toHaveBeenCalled()
			expect(values.getVariableValue('conn', banned)).toBeUndefined()
		})

		test('silently skips all BANNED_PROPS entries without emitting', () => {
			const listener = vi.fn()
			values.on('variables_changed', listener)

			for (const banned of BANNED_PROPS) {
				values.setVariableValues('conn', [entry(banned, 'evil')])
			}

			expect(listener).not.toHaveBeenCalled()
		})

		test('for the "custom" label, also emits internal:custom_<id> in the changed set', () => {
			const listener = vi.fn()
			values.on('variables_changed', listener)

			values.setVariableValues('custom', [entry('myvar', 'val')])

			const [changedSet] = listener.mock.calls[0] as [ReadonlySet<string>]
			expect(changedSet.has('custom:myvar')).toBe(true)
			expect(changedSet.has('internal:custom_myvar')).toBe(true)
		})

		test('for non-"custom" labels, does not emit internal:custom_<id>', () => {
			const listener = vi.fn()
			values.on('variables_changed', listener)

			values.setVariableValues('conn', [entry('myvar', 'val')])

			const [changedSet] = listener.mock.calls[0] as [ReadonlySet<string>]
			expect(changedSet.has('internal:custom_myvar')).toBe(false)
		})

		test('can set a variable to undefined (clearing its value)', () => {
			values.setVariableValues('conn', [entry('v', 'initial')])
			values.setVariableValues('conn', [entry('v', undefined)])
			expect(values.getVariableValue('conn', 'v')).toBeUndefined()
		})

		test('does not emit when re-setting a variable to undefined that was already undefined', () => {
			// v was never set, so its stored value is already undefined — no change
			values.setVariableValues('conn', [entry('v', undefined)])
			const listener = vi.fn()
			values.on('variables_changed', listener)

			values.setVariableValues('conn', [entry('v', undefined)])

			expect(listener).not.toHaveBeenCalled()
		})

		test('stores multiple variables at once', () => {
			values.setVariableValues('conn', [entry('a', 1), entry('b', 'two'), entry('c', true)])
			expect(values.getVariableValue('conn', 'a')).toBe(1)
			expect(values.getVariableValue('conn', 'b')).toBe('two')
			expect(values.getVariableValue('conn', 'c')).toBe(true)
		})
	})

	describe('forgetConnection', () => {
		test('makes all variables for the label inaccessible', () => {
			values.setVariableValues('conn', [entry('a', 1), entry('b', 2)])
			values.forgetConnection('id', 'conn')
			expect(values.getVariableValue('conn', 'a')).toBeUndefined()
			expect(values.getVariableValue('conn', 'b')).toBeUndefined()
		})

		test('emits variables_changed with all removed variable IDs', () => {
			values.setVariableValues('conn', [entry('a', 1), entry('b', 2)])
			const listener = vi.fn()
			values.on('variables_changed', listener)

			values.forgetConnection('id', 'conn')

			expect(listener).toHaveBeenCalledOnce()
			const [changedSet, labelsSet] = listener.mock.calls[0] as [ReadonlySet<string>, ReadonlySet<string>]
			expect(changedSet.has('conn:a')).toBe(true)
			expect(changedSet.has('conn:b')).toBe(true)
			expect(labelsSet.has('conn')).toBe(true)
		})

		test('does not emit variables_changed for a non-existent label', () => {
			const listener = vi.fn()
			values.on('variables_changed', listener)

			values.forgetConnection('id', 'nonexistent')

			expect(listener).not.toHaveBeenCalled()
		})

		test('second call with the same label is a no-op — no event emitted', () => {
			values.setVariableValues('conn', [entry('a', 1)])
			values.forgetConnection('id', 'conn')
			const listener = vi.fn()
			values.on('variables_changed', listener)

			values.forgetConnection('id', 'conn')

			expect(listener).not.toHaveBeenCalled()
		})

		test('new variables can be set for the label after forgetConnection', () => {
			values.setVariableValues('conn', [entry('old', 1)])
			values.forgetConnection('id', 'conn')

			values.setVariableValues('conn', [entry('new', 99)])

			expect(values.getVariableValue('conn', 'new')).toBe(99)
			expect(values.getVariableValue('conn', 'old')).toBeUndefined()
		})
	})

	describe('connectionLabelRename', () => {
		test('makes variables available under the new label', () => {
			values.setVariableValues('old', [entry('a', 1), entry('b', 2)])
			values.connectionLabelRename('old', 'new')
			expect(values.getVariableValue('new', 'a')).toBe(1)
			expect(values.getVariableValue('new', 'b')).toBe(2)
		})

		test('removes variables from the old label', () => {
			values.setVariableValues('old', [entry('a', 1)])
			values.connectionLabelRename('old', 'new')
			expect(values.getVariableValue('old', 'a')).toBeUndefined()
		})

		test('emits variables_changed with both old and new variable IDs and labels', () => {
			values.setVariableValues('old', [entry('a', 1)])
			const listener = vi.fn()
			values.on('variables_changed', listener)

			values.connectionLabelRename('old', 'new')

			expect(listener).toHaveBeenCalledOnce()
			const [changedSet, labelsSet] = listener.mock.calls[0] as [ReadonlySet<string>, ReadonlySet<string>]
			expect(changedSet.has('old:a')).toBe(true)
			expect(changedSet.has('new:a')).toBe(true)
			expect(labelsSet.has('old')).toBe(true)
			expect(labelsSet.has('new')).toBe(true)
		})

		test('non-existent labelFrom: no event emitted', () => {
			const listener = vi.fn()
			values.on('variables_changed', listener)

			values.connectionLabelRename('nonexistent', 'dest')

			expect(listener).not.toHaveBeenCalled()
		})

		test('merges into an existing labelTo, preserving its pre-existing variables', () => {
			values.setVariableValues('dest', [entry('existing', 'keep')])
			values.setVariableValues('src', [entry('moved', 'val')])

			values.connectionLabelRename('src', 'dest')

			expect(values.getVariableValue('dest', 'existing')).toBe('keep')
			expect(values.getVariableValue('dest', 'moved')).toBe('val')
		})

		test('overlapping variable name: labelFrom value overwrites labelTo value', () => {
			values.setVariableValues('dest', [entry('shared', 'original')])
			values.setVariableValues('src', [entry('shared', 'replacement')])

			values.connectionLabelRename('src', 'dest')

			expect(values.getVariableValue('dest', 'shared')).toBe('replacement')
		})

		test('same-label rename is a no-op', () => {
			values.setVariableValues('conn', [entry('a', 1), entry('b', 2)])
			values.connectionLabelRename('conn', 'conn')
			expect(values.getVariableValue('conn', 'a')).toBe(1)
			expect(values.getVariableValue('conn', 'b')).toBe(2)
		})
	})

	describe('triggerLocationVariablesChange', () => {
		test('emits the local_variables_changed event', () => {
			const listener = vi.fn()
			values.on('local_variables_changed', listener)

			values.triggerLocationVariablesChange('ctrl-1')

			expect(listener).toHaveBeenCalledOnce()
		})

		test('passes the controlId as the second argument', () => {
			const listener = vi.fn()
			values.on('local_variables_changed', listener)

			values.triggerLocationVariablesChange('my-control-id')

			expect(listener.mock.calls[0][1]).toBe('my-control-id')
		})

		test('emitted variable IDs have the $(...) wrapper stripped', () => {
			const listener = vi.fn()
			values.on('local_variables_changed', listener)
			values.triggerLocationVariablesChange('ctrl-1')

			const [changedSet] = listener.mock.calls[0] as [ReadonlySet<string>]
			for (const id of changedSet) {
				expect(id.startsWith('$(')).toBe(false)
				expect(id.endsWith(')')).toBe(false)
			}
		})

		test('emitted set contains all expected this:* variable names', () => {
			const listener = vi.fn()
			values.on('local_variables_changed', listener)
			values.triggerLocationVariablesChange('ctrl-1')

			const [changedSet] = listener.mock.calls[0] as [ReadonlySet<string>]
			const expected = [
				'this:page',
				'this:row',
				'this:column',
				'this:location',
				'this:page_name',
				'this:active',
				'this:step',
				'this:step_count',
				'this:actions_running',
				'this:button_status',
			]
			for (const id of expected) {
				expect(changedSet.has(id), `expected "${id}" in changed set`).toBe(true)
			}
		})
	})
})
