import { describe, expect, test, vi } from 'vitest'
import type { CustomActionRunFrame } from '../../lib/Controls/CustomActionRunFrame.js'
import type { RunActionExtras } from '../../lib/Instance/Connection/ChildHandlerApi.js'
import { LocalVariablesController } from '../../lib/Variables/LocalVariablesController.js'
import { createStore, threePages } from '../Page/Helpers.js'

interface MockEntityProps {
	feedbackValue?: any
	startupValue?: any
	connectionId?: string
	definitionId?: string
	localVariableName?: string | null
}

function makeVariableEntity(name: string, props: MockEntityProps = {}) {
	return {
		id: `entity-${name}`,
		rawLocalVariableName: name,
		localVariableName: props.localVariableName === undefined ? `local:${name}` : props.localVariableName,
		rawOptions: { startup_value: { value: props.startupValue } },
		feedbackValue: props.feedbackValue,
		asEntityModel: () => ({
			type: 'feedback',
			connectionId: props.connectionId ?? 'internal',
			definitionId: props.definitionId ?? 'user_value',
		}),
	}
}

function makeControl(entities: any[], isEditable = true) {
	return {
		supportsEntities: true,
		entities: {
			isEditable,
			getAllEntitiesInList: (listId: string) => (listId === 'local-variables' ? entities : []),
			entitySetVariableValue: vi.fn(),
			entitySetOption: vi.fn(),
		},
	}
}

function createController(controls: Record<string, any> = {}) {
	const { store } = createStore(threePages())
	const controlsStore = {
		getControl: vi.fn((controlId: string) => controls[controlId]),
	}
	const controller = new LocalVariablesController(controlsStore as any, store)
	return { controller, controlsStore, store }
}

function makeExtras(): RunActionExtras {
	return {
		controlId: 'control-self',
		location: { pageNumber: 1, row: 0, column: 0 },
	} as any
}

describe('LocalVariablesController', () => {
	describe('localVariableFor', () => {
		test('a missing name or location returns null', () => {
			const { controller } = createController()

			expect(controller.localVariableFor('this', undefined, makeExtras())).toBe(null)
			expect(controller.localVariableFor('this', '', makeExtras())).toBe(null)
			expect(controller.localVariableFor(undefined, 'my_var', makeExtras())).toBe(null)
		})

		test('the location "this" resolves to the calling control', () => {
			const { controller } = createController()

			expect(controller.localVariableFor('this', 'my_var', makeExtras())).toEqual({
				controlId: 'control-self',
				name: 'my_var',
				frame: null,
			})
			// Case and whitespace insensitive
			expect(controller.localVariableFor('  THIS ', 'my_var', makeExtras())).toEqual({
				controlId: 'control-self',
				name: 'my_var',
				frame: null,
			})
		})

		test('an explicit location resolves through the page store', () => {
			const { controller } = createController()

			expect(controller.localVariableFor('2/1/2', 'my_var', makeExtras())).toEqual({
				controlId: 'control-b1',
				name: 'my_var',
				frame: null,
			})
		})

		test('a non-string name is coerced', () => {
			const { controller } = createController()

			expect(controller.localVariableFor('this', 42, makeExtras())).toEqual({
				controlId: 'control-self',
				name: '42',
				frame: null,
			})
		})

		test('an empty grid location returns null', () => {
			const { controller } = createController()

			expect(controller.localVariableFor('1/3/3', 'my_var', makeExtras())).toBe(null)
		})

		test('an unparsable location returns null', () => {
			const { controller } = createController()

			expect(controller.localVariableFor('nonsense', 'my_var', makeExtras())).toBe(null)
		})
	})

	describe('pageVariableFor', () => {
		test('a missing name returns null', () => {
			const { controller } = createController()

			expect(controller.pageVariableFor(2, undefined, 1)).toBe(null)
			expect(controller.pageVariableFor(2, '', 1)).toBe(null)
		})

		test('an explicit page number resolves to its page control', () => {
			const { controller } = createController()

			expect(controller.pageVariableFor(2, 'my_var', 1)).toEqual({
				controlId: 'page:page-b',
				name: 'my_var',
				frame: null,
			})
		})

		test('page 0 ("this page") resolves against the provided page number', () => {
			const { controller } = createController()

			expect(controller.pageVariableFor(0, 'my_var', 1)).toEqual({
				controlId: 'page:page-a',
				name: 'my_var',
				frame: null,
			})
		})

		test('page 0 with no "this page" returns null', () => {
			const { controller } = createController()

			expect(controller.pageVariableFor(0, 'my_var', null)).toBe(null)
		})

		test('an out-of-range page number returns null', () => {
			const { controller } = createController()

			expect(controller.pageVariableFor(99, 'my_var', 1)).toBe(null)
		})

		test('a non-string name is coerced', () => {
			const { controller } = createController()

			expect(controller.pageVariableFor(3, 42, 1)).toEqual({
				controlId: 'page:page-c',
				name: '42',
				frame: null,
			})
		})
	})

	describe('setLocalVariable', () => {
		test('sets the value on the matching entity', () => {
			const entity = makeVariableEntity('my_var')
			const control = makeControl([entity])
			const { controller } = createController({ 'control-a1': control })

			controller.setLocalVariable({ controlId: 'control-a1', name: 'my_var', frame: null }, 'new value')

			expect(control.entities.entitySetVariableValue).toHaveBeenCalledWith('local-variables', entity.id, 'new value')
		})

		test('an unknown control is ignored', () => {
			const { controller } = createController()

			expect(() =>
				controller.setLocalVariable({ controlId: 'missing', name: 'my_var', frame: null }, 'x')
			).not.toThrow()
		})

		test('a control without entity support is ignored', () => {
			const control = { supportsEntities: false }
			const { controller } = createController({ 'control-a1': control })

			expect(() =>
				controller.setLocalVariable({ controlId: 'control-a1', name: 'my_var', frame: null }, 'x')
			).not.toThrow()
		})

		test('an unknown variable name is ignored', () => {
			const control = makeControl([makeVariableEntity('other_var')])
			const { controller } = createController({ 'control-a1': control })

			controller.setLocalVariable({ controlId: 'control-a1', name: 'my_var', frame: null }, 'x')

			expect(control.entities.entitySetVariableValue).not.toHaveBeenCalled()
		})

		test('an entity without a resolved variable name is ignored', () => {
			const control = makeControl([makeVariableEntity('my_var', { localVariableName: null })])
			const { controller } = createController({ 'control-a1': control })

			controller.setLocalVariable({ controlId: 'control-a1', name: 'my_var', frame: null }, 'x')

			expect(control.entities.entitySetVariableValue).not.toHaveBeenCalled()
		})

		test('entities of other types are ignored', () => {
			const notUserValue = makeVariableEntity('my_var', { definitionId: 'something_else' })
			const notInternal = makeVariableEntity('my_var', { connectionId: 'conn1' })
			const control = makeControl([notUserValue, notInternal])
			const { controller } = createController({ 'control-a1': control })

			controller.setLocalVariable({ controlId: 'control-a1', name: 'my_var', frame: null }, 'x')

			expect(control.entities.entitySetVariableValue).not.toHaveBeenCalled()
		})
	})

	describe('resetLocalVariable', () => {
		test('restores the startup value', () => {
			const entity = makeVariableEntity('my_var', { startupValue: 'startup' })
			const control = makeControl([entity])
			const { controller } = createController({ 'control-a1': control })

			controller.resetLocalVariable({ controlId: 'control-a1', name: 'my_var', frame: null })

			expect(control.entities.entitySetVariableValue).toHaveBeenCalledWith('local-variables', entity.id, 'startup')
		})
	})

	describe('writeLocalVariableStartupValue', () => {
		test('stores the current value as the startup value', () => {
			const entity = makeVariableEntity('my_var', { feedbackValue: 'current' })
			const control = makeControl([entity])
			const { controller } = createController({ 'control-a1': control })

			controller.writeLocalVariableStartupValue({ controlId: 'control-a1', name: 'my_var', frame: null })

			expect(control.entities.entitySetOption).toHaveBeenCalledWith('local-variables', entity.id, 'startup_value', {
				isExpression: false,
				value: 'current',
			})
		})
	})

	describe('a control with a read-only entity pool (e.g. a preset reference)', () => {
		test('setLocalVariable still sets the value', () => {
			const entity = makeVariableEntity('my_var')
			const control = makeControl([entity], false)
			const { controller } = createController({ 'control-a1': control })

			controller.setLocalVariable({ controlId: 'control-a1', name: 'my_var', frame: null }, 'new value')

			expect(control.entities.entitySetVariableValue).toHaveBeenCalledWith('local-variables', entity.id, 'new value')
		})

		test('resetLocalVariable still restores the startup value', () => {
			const entity = makeVariableEntity('my_var', { startupValue: 'startup' })
			const control = makeControl([entity], false)
			const { controller } = createController({ 'control-a1': control })

			controller.resetLocalVariable({ controlId: 'control-a1', name: 'my_var', frame: null })

			expect(control.entities.entitySetVariableValue).toHaveBeenCalledWith('local-variables', entity.id, 'startup')
		})

		test('writeLocalVariableStartupValue is rejected, as it edits the configuration', () => {
			const entity = makeVariableEntity('my_var', { feedbackValue: 'current' })
			const control = makeControl([entity], false)
			const { controller } = createController({ 'control-a1': control })

			controller.writeLocalVariableStartupValue({ controlId: 'control-a1', name: 'my_var', frame: null })

			expect(control.entities.entitySetOption).not.toHaveBeenCalled()
		})
	})

	describe('inside a run of a custom action', () => {
		function makeFrame(): CustomActionRunFrame {
			return {
				customActionControlId: 'custom-action:abc',
				options: {},
				localValues: new Map(),
				getLocalVariableEntities: () => [],
				localValueChanged: vi.fn(),
			}
		}

		test('the location "this" resolves to the custom action and its run', () => {
			const { controller } = createController()
			const frame = makeFrame()

			expect(controller.localVariableFor('this', 'my_var', { ...makeExtras(), frame })).toEqual({
				controlId: 'custom-action:abc',
				name: 'my_var',
				frame,
			})
		})

		test('an explicit location resolves to the control, not the run', () => {
			const { controller } = createController()

			expect(controller.localVariableFor('2/1/2', 'my_var', { ...makeExtras(), frame: makeFrame() })).toEqual({
				controlId: 'control-b1',
				name: 'my_var',
				frame: null,
			})
		})

		test('setLocalVariable only sets the value for the run', () => {
			const entity = makeVariableEntity('my_var')
			const control = makeControl([entity])
			const { controller } = createController({ 'custom-action:abc': control })
			const frame = makeFrame()

			expect(controller.setLocalVariable({ controlId: 'custom-action:abc', name: 'my_var', frame }, 'value')).toBe(true)

			expect(frame.localValues.get('my_var')).toBe('value')
			expect(frame.localValueChanged).toHaveBeenCalledWith('my_var')
			expect(control.entities.entitySetVariableValue).not.toHaveBeenCalled()
		})

		test('setLocalVariable rejects a variable which is not a user value', () => {
			const control = makeControl([makeVariableEntity('my_var', { definitionId: 'something_else' })])
			const { controller } = createController({ 'custom-action:abc': control })
			const frame = makeFrame()

			expect(controller.setLocalVariable({ controlId: 'custom-action:abc', name: 'my_var', frame }, 'value')).toBe(
				false
			)
			expect(frame.localValues.size).toBe(0)
			expect(frame.localValueChanged).not.toHaveBeenCalled()
		})

		test('resetLocalVariable forgets the value of the run', () => {
			const control = makeControl([makeVariableEntity('my_var', { startupValue: 'startup' })])
			const { controller } = createController({ 'custom-action:abc': control })
			const frame = makeFrame()
			frame.localValues.set('my_var', 'value')

			expect(controller.resetLocalVariable({ controlId: 'custom-action:abc', name: 'my_var', frame })).toBe(true)

			expect(frame.localValues.has('my_var')).toBe(false)
			expect(frame.localValueChanged).toHaveBeenCalledWith('my_var')
			expect(control.entities.entitySetVariableValue).not.toHaveBeenCalled()
		})

		test('writeLocalVariableStartupValue is rejected', () => {
			const control = makeControl([makeVariableEntity('my_var', { feedbackValue: 'current' })])
			const { controller } = createController({ 'custom-action:abc': control })

			expect(
				controller.writeLocalVariableStartupValue({
					controlId: 'custom-action:abc',
					name: 'my_var',
					frame: makeFrame(),
				})
			).toBe(false)
			expect(control.entities.entitySetOption).not.toHaveBeenCalled()
		})

		test('getLocalVariableContextFor uses the values of the run', () => {
			const control = makeControl([
				makeVariableEntity('my_var', { feedbackValue: 'startup' }),
				makeVariableEntity('other', { feedbackValue: 'other startup' }),
			])
			const { controller } = createController({ 'custom-action:abc': control })
			const frame = makeFrame()
			frame.localValues.set('my_var', 'run value')

			expect(controller.getLocalVariableContextFor({ controlId: 'custom-action:abc', name: 'my_var', frame })).toEqual({
				'this:current': 'run value',
				'target:my_var': 'run value',
				'target:other': 'other startup',
			})
		})
	})
})
