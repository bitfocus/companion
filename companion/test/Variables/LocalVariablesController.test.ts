import { describe, expect, test, vi } from 'vitest'
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

function makeControl(entities: any[]) {
	return {
		supportsEntities: true,
		entities: {
			isEditable: true,
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
			})
			// Case and whitespace insensitive
			expect(controller.localVariableFor('  THIS ', 'my_var', makeExtras())).toEqual({
				controlId: 'control-self',
				name: 'my_var',
			})
		})

		test('an explicit location resolves through the page store', () => {
			const { controller } = createController()

			expect(controller.localVariableFor('2/1/2', 'my_var', makeExtras())).toEqual({
				controlId: 'control-b1',
				name: 'my_var',
			})
		})

		test('a non-string name is coerced', () => {
			const { controller } = createController()

			expect(controller.localVariableFor('this', 42, makeExtras())).toEqual({
				controlId: 'control-self',
				name: '42',
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

	describe('setLocalVariable', () => {
		test('sets the value on the matching entity', () => {
			const entity = makeVariableEntity('my_var')
			const control = makeControl([entity])
			const { controller } = createController({ 'control-a1': control })

			controller.setLocalVariable({ controlId: 'control-a1', name: 'my_var' }, 'new value')

			expect(control.entities.entitySetVariableValue).toHaveBeenCalledWith('local-variables', entity.id, 'new value')
		})

		test('an unknown control is ignored', () => {
			const { controller } = createController()

			expect(() => controller.setLocalVariable({ controlId: 'missing', name: 'my_var' }, 'x')).not.toThrow()
		})

		test('a control without entity support is ignored', () => {
			const control = { supportsEntities: false }
			const { controller } = createController({ 'control-a1': control })

			expect(() => controller.setLocalVariable({ controlId: 'control-a1', name: 'my_var' }, 'x')).not.toThrow()
		})

		test('an unknown variable name is ignored', () => {
			const control = makeControl([makeVariableEntity('other_var')])
			const { controller } = createController({ 'control-a1': control })

			controller.setLocalVariable({ controlId: 'control-a1', name: 'my_var' }, 'x')

			expect(control.entities.entitySetVariableValue).not.toHaveBeenCalled()
		})

		test('an entity without a resolved variable name is ignored', () => {
			const control = makeControl([makeVariableEntity('my_var', { localVariableName: null })])
			const { controller } = createController({ 'control-a1': control })

			controller.setLocalVariable({ controlId: 'control-a1', name: 'my_var' }, 'x')

			expect(control.entities.entitySetVariableValue).not.toHaveBeenCalled()
		})

		test('entities of other types are ignored', () => {
			const notUserValue = makeVariableEntity('my_var', { definitionId: 'something_else' })
			const notInternal = makeVariableEntity('my_var', { connectionId: 'conn1' })
			const control = makeControl([notUserValue, notInternal])
			const { controller } = createController({ 'control-a1': control })

			controller.setLocalVariable({ controlId: 'control-a1', name: 'my_var' }, 'x')

			expect(control.entities.entitySetVariableValue).not.toHaveBeenCalled()
		})
	})

	describe('resetLocalVariable', () => {
		test('restores the startup value', () => {
			const entity = makeVariableEntity('my_var', { startupValue: 'startup' })
			const control = makeControl([entity])
			const { controller } = createController({ 'control-a1': control })

			controller.resetLocalVariable({ controlId: 'control-a1', name: 'my_var' })

			expect(control.entities.entitySetVariableValue).toHaveBeenCalledWith('local-variables', entity.id, 'startup')
		})
	})

	describe('writeLocalVariableStartupValue', () => {
		test('stores the current value as the startup value', () => {
			const entity = makeVariableEntity('my_var', { feedbackValue: 'current' })
			const control = makeControl([entity])
			const { controller } = createController({ 'control-a1': control })

			controller.writeLocalVariableStartupValue({ controlId: 'control-a1', name: 'my_var' })

			expect(control.entities.entitySetOption).toHaveBeenCalledWith('local-variables', entity.id, 'startup_value', {
				isExpression: false,
				value: 'current',
			})
		})
	})
})
