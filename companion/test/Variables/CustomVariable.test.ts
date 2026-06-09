import { initTRPC } from '@trpc/server'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { CustomVariableDefinition } from '@companion-app/shared/Model/CustomVariableModel.js'
import type { TrpcContext } from '../../lib/UI/TRPC.js'
import { VariablesCustomVariable } from '../../lib/Variables/CustomVariable.js'
import { VariablesValues } from '../../lib/Variables/Values.js'
import { createMockTrpcContext } from '../Util.js'
import { FakeDataDatabase } from '../utils/FakeTableView.js'
import { SubscriptionTester } from '../utils/SubscriptionTester.js'

const t = initTRPC.context<TrpcContext>().create()
const testCtx: TrpcContext = createMockTrpcContext()

function makeDef(overrides: Partial<CustomVariableDefinition> = {}): CustomVariableDefinition {
	return {
		description: 'A custom variable',
		defaultValue: 'def',
		persistCurrentValue: false,
		sortOrder: 0,
		...overrides,
	}
}

function createCustomVariables(initial?: Record<string, CustomVariableDefinition>) {
	const db = new FakeDataDatabase()
	const table = db.getTableView('custom_variables')
	if (initial) table.data = structuredClone(initial)

	const values = new VariablesValues()
	const custom = new VariablesCustomVariable(db.asDataDatabase(), values)

	const definitionChanged = vi.fn()
	custom.on('custom_variable_definition_changed', definitionChanged)

	const caller = t.createCallerFactory(custom.createTrpcRouter())(testCtx)

	return { db, table, values, custom, definitionChanged, caller }
}

describe('VariablesCustomVariable', () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})
	afterEach(() => {
		vi.useRealTimers()
	})

	describe('createVariable', () => {
		test('creates the variable, sets its value and persists it', () => {
			const { custom, table, definitionChanged } = createCustomVariables()

			expect(custom.createVariable('my_var', 'hello')).toBe(null)

			const expectedDefinition = makeDef({ defaultValue: 'hello' })
			expect(custom.getDefinitions()).toEqual({ my_var: expectedDefinition })
			expect(custom.hasCustomVariable('my_var')).toBe(true)
			expect(table.data['my_var']).toEqual(expectedDefinition)
			expect(custom.getValue('my_var')).toBe('hello')
			expect(definitionChanged).toHaveBeenCalledWith('my_var', expectedDefinition)
		})

		test('sort orders increment from the highest existing', () => {
			const { custom } = createCustomVariables({ existing: makeDef({ sortOrder: 5 }) })

			custom.createVariable('second', '')
			custom.createVariable('third', '')

			expect(custom.getDefinitions()['second'].sortOrder).toBe(6)
			expect(custom.getDefinitions()['third'].sortOrder).toBe(7)
		})

		test('rejects a duplicate name', () => {
			const { custom } = createCustomVariables({ my_var: makeDef() })

			expect(custom.createVariable('my_var', 'x')).toMatch(/already exists/)
			expect(custom.getDefinitions()['my_var'].defaultValue).toBe('def')
		})

		test('rejects reserved names', () => {
			const { custom, table } = createCustomVariables()

			expect(custom.createVariable('__proto__', 'x')).toMatch(/reserved/)
			expect(custom.createVariable('constructor', 'x')).toMatch(/reserved/)
			expect(custom.createVariable('prototype', 'x')).toMatch(/reserved/)
			expect(custom.hasCustomVariable('__proto__')).toBe(false)
			expect(table.data).toEqual({})
		})

		test('rejects invalid names', () => {
			const { custom } = createCustomVariables()

			expect(custom.createVariable('my var', 'x')).toMatch(/not valid/)
			expect(custom.createVariable('foo!', 'x')).toMatch(/not valid/)
			expect(custom.createVariable('', 'x')).toMatch(/not valid/)
			expect(custom.getDefinitions()).toEqual({})
		})
	})

	describe('prototype safety', () => {
		test('prototype keys are not treated as existing variables by any mutation', () => {
			const { custom } = createCustomVariables({ my_var: makeDef() })

			expect(custom.hasCustomVariable('__proto__')).toBe(false)
			expect(custom.setValue('__proto__', 'polluted')).toBe('Unknown name')
			expect(custom.setVariableDescription('__proto__', 'polluted')).toBe('Unknown name')
			expect(custom.setPersistence('__proto__', true)).toBe('Unknown name')
			expect(custom.setVariableDefaultValue('__proto__', 'polluted')).toBe('Unknown name')
			expect(custom.getVariableDescription('__proto__')).toBe('Unknown name')
			custom.setOrder(null, '__proto__', 0)
			custom.syncValueToDefault('__proto__')
			custom.resetValueToDefault('__proto__')

			// Object.prototype was not polluted by any of the above
			const probe: any = {}
			expect(probe.description).toBe(undefined)
			expect(probe.persistCurrentValue).toBe(undefined)
			expect(probe.defaultValue).toBe(undefined)
			expect(probe.sortOrder).toBe(undefined)
			expect(probe.collectionId).toBe(undefined)
		})

		test('definitions loaded or replaced are also prototype-less', () => {
			const { custom } = createCustomVariables({ my_var: makeDef() })
			expect(custom.hasCustomVariable('constructor')).toBe(false)

			custom.replaceDefinitions({ other_var: makeDef() })
			expect(custom.hasCustomVariable('constructor')).toBe(false)
			expect(custom.hasCustomVariable('__proto__')).toBe(false)

			custom.reset()
			expect(custom.hasCustomVariable('constructor')).toBe(false)
		})
	})

	describe('deleteVariable', () => {
		test('removes the definition, value and persistence', () => {
			const { custom, table, values, definitionChanged } = createCustomVariables({ my_var: makeDef() })
			custom.init()
			expect(values.getCustomVariableValue('my_var')).toBe('def')

			custom.deleteVariable('my_var')

			expect(custom.hasCustomVariable('my_var')).toBe(false)
			expect(table.data['my_var']).toBe(undefined)
			expect(custom.getValue('my_var')).toBe(undefined)
			expect(definitionChanged).toHaveBeenCalledWith('my_var', null)
		})
	})

	describe('values', () => {
		test('setValue and getValue round-trip', () => {
			const { custom } = createCustomVariables({ my_var: makeDef() })

			expect(custom.setValue('my_var', 'new value')).toBe(null)
			expect(custom.getValue('my_var')).toBe('new value')
		})

		test('setValue rejects an unknown variable', () => {
			const { custom } = createCustomVariables()

			expect(custom.setValue('unknown', 'x')).toBe('Unknown name')
		})

		test('setValue does not touch the default for non-persisted variables', () => {
			const { custom, table } = createCustomVariables({ my_var: makeDef() })

			custom.setValue('my_var', 'new value')

			expect(custom.getDefinitions()['my_var'].defaultValue).toBe('def')
			expect(table.data['my_var'].defaultValue).toBe('def')
		})

		test('resetValueToDefault restores the default value', () => {
			const { custom } = createCustomVariables({ my_var: makeDef() })
			custom.init()

			custom.setValue('my_var', 'changed')
			custom.resetValueToDefault('my_var')

			expect(custom.getValue('my_var')).toBe('def')
		})

		test('syncValueToDefault stores and persists the current value as default', () => {
			const { custom, table } = createCustomVariables({ my_var: makeDef() })
			custom.init()

			custom.setValue('my_var', 'current')
			custom.syncValueToDefault('my_var')

			expect(custom.getDefinitions()['my_var'].defaultValue).toBe('current')
			expect(table.data['my_var'].defaultValue).toBe('current')
		})
	})

	describe('persistence', () => {
		test('enabling persistence captures the current value as the default', () => {
			const { custom, table } = createCustomVariables({ my_var: makeDef() })
			custom.init()
			custom.setValue('my_var', 'current')

			expect(custom.setPersistence('my_var', true)).toBe(null)

			expect(custom.getDefinitions()['my_var'].persistCurrentValue).toBe(true)
			expect(table.data['my_var'].defaultValue).toBe('current')
		})

		test('an unset current value is captured as an empty string', () => {
			const { custom, table } = createCustomVariables({ my_var: makeDef() })
			// no init(), so no value is set

			custom.setPersistence('my_var', true)

			expect(table.data['my_var'].defaultValue).toBe('')
		})

		test('values set on a persisted variable update the stored default', () => {
			const { custom, table } = createCustomVariables({ my_var: makeDef({ persistCurrentValue: true }) })

			custom.setValue('my_var', 'persisted')

			expect(table.data['my_var'].defaultValue).toBe('persisted')
		})

		test('the default of a persisted variable cannot be changed directly', () => {
			const { custom } = createCustomVariables({ my_var: makeDef({ persistCurrentValue: true }) })

			expect(custom.setVariableDefaultValue('my_var', 'nope')).toBe('Cannot change default')
		})

		test('setVariableDefaultValue updates a non-persisted variable', () => {
			const { custom, table } = createCustomVariables({ my_var: makeDef() })

			expect(custom.setVariableDefaultValue('my_var', 'new default')).toBe(null)
			expect(table.data['my_var'].defaultValue).toBe('new default')
		})

		test('unknown variables are rejected', () => {
			const { custom } = createCustomVariables()

			expect(custom.setPersistence('unknown', true)).toBe('Unknown name')
			expect(custom.setVariableDefaultValue('unknown', 'x')).toBe('Unknown name')
		})
	})

	describe('description', () => {
		test('set and get', () => {
			const { custom, table } = createCustomVariables({ my_var: makeDef() })

			expect(custom.setVariableDescription('my_var', 'What it does')).toBe(null)
			expect(custom.getVariableDescription('my_var')).toBe('What it does')
			expect(table.data['my_var'].description).toBe('What it does')

			expect(custom.setVariableDescription('unknown', 'x')).toBe('Unknown name')
			expect(custom.getVariableDescription('unknown')).toBe('Unknown name')
		})
	})

	describe('init', () => {
		test('loads default values and announces the definitions', () => {
			const { custom, values, definitionChanged } = createCustomVariables({
				var_a: makeDef({ defaultValue: 'a value' }),
				var_b: makeDef({ defaultValue: 'b value', sortOrder: 1 }),
			})

			custom.init()

			expect(values.getCustomVariableValue('var_a')).toBe('a value')
			expect(values.getCustomVariableValue('var_b')).toBe('b value')
			expect(definitionChanged).toHaveBeenCalledTimes(2)
			expect(definitionChanged).toHaveBeenCalledWith('var_a', makeDef({ defaultValue: 'a value' }))
		})
	})

	describe('replaceDefinitions', () => {
		test('applies the difference between old and new', () => {
			const { custom, table, values, definitionChanged } = createCustomVariables({
				kept: makeDef({ defaultValue: 'old' }),
				removed: makeDef({ sortOrder: 1 }),
			})
			custom.init()

			custom.replaceDefinitions({
				kept: makeDef({ defaultValue: 'updated' }),
				added: makeDef({ defaultValue: 'fresh', sortOrder: 1 }),
			})

			expect(Object.keys(custom.getDefinitions()).sort()).toEqual(['added', 'kept'])
			expect(table.data['kept'].defaultValue).toBe('updated')
			expect(table.data['added']).toBeTruthy()
			expect(table.data['removed']).toBe(undefined)

			expect(values.getCustomVariableValue('added')).toBe('fresh')
			expect(values.getCustomVariableValue('removed')).toBe(undefined)

			expect(definitionChanged).toHaveBeenCalledWith('kept', makeDef({ defaultValue: 'updated' }))
			expect(definitionChanged).toHaveBeenCalledWith('added', makeDef({ defaultValue: 'fresh', sortOrder: 1 }))
			expect(definitionChanged).toHaveBeenCalledWith('removed', null)
		})
	})

	describe('reset', () => {
		test('removes all variables', () => {
			const { custom, table, definitionChanged } = createCustomVariables({
				var_a: makeDef(),
				var_b: makeDef({ sortOrder: 1 }),
			})

			custom.reset()

			expect(custom.getDefinitions()).toEqual({})
			expect(table.data).toEqual({})
			expect(definitionChanged).toHaveBeenCalledWith('var_a', null)
			expect(definitionChanged).toHaveBeenCalledWith('var_b', null)
		})
	})

	describe('setOrder', () => {
		test('reorders within the root group', () => {
			const { custom, table } = createCustomVariables({
				var_a: makeDef({ sortOrder: 0 }),
				var_b: makeDef({ sortOrder: 1 }),
				var_c: makeDef({ sortOrder: 2 }),
			})

			custom.setOrder(null, 'var_c', 0)

			const defs = custom.getDefinitions()
			expect(defs['var_c'].sortOrder).toBe(0)
			expect(defs['var_a'].sortOrder).toBe(1)
			expect(defs['var_b'].sortOrder).toBe(2)

			expect(table.data['var_c'].sortOrder).toBe(0)
			expect(table.data['var_a'].sortOrder).toBe(1)
			expect(table.data['var_b'].sortOrder).toBe(2)
		})

		test('a negative dropIndex moves the variable to the end', () => {
			const { custom } = createCustomVariables({
				var_a: makeDef({ sortOrder: 0 }),
				var_b: makeDef({ sortOrder: 1 }),
				var_c: makeDef({ sortOrder: 2 }),
			})

			custom.setOrder(null, 'var_a', -1)

			const defs = custom.getDefinitions()
			expect(defs['var_b'].sortOrder).toBe(0)
			expect(defs['var_c'].sortOrder).toBe(1)
			expect(defs['var_a'].sortOrder).toBe(2)
		})

		test('unknown variables and collections are ignored', () => {
			const { custom } = createCustomVariables({ var_a: makeDef() })

			custom.setOrder(null, 'unknown', 0)
			custom.setOrder('missing-collection', 'var_a', 0)

			expect(custom.getDefinitions()['var_a']).toEqual(makeDef())
		})

		test('moves a variable into a collection', () => {
			const { custom, table } = createCustomVariables({
				var_a: makeDef({ sortOrder: 0 }),
				var_b: makeDef({ sortOrder: 1 }),
			})
			custom.replaceCollections([{ id: 'col1', label: 'Collection', sortOrder: 0, children: [], metaData: null }])

			custom.setOrder('col1', 'var_a', 0)

			expect(custom.getDefinitions()['var_a'].collectionId).toBe('col1')
			expect(custom.getDefinitions()['var_a'].sortOrder).toBe(0)
			expect(table.data['var_a'].collectionId).toBe('col1')
			// var_b is unaffected
			expect(custom.getDefinitions()['var_b'].collectionId).toBe(undefined)
		})

		test('removing a collection moves its variables back to the root', () => {
			const { custom, table } = createCustomVariables({
				var_a: makeDef({ collectionId: 'col1' }),
			})
			custom.replaceCollections([{ id: 'col1', label: 'Collection', sortOrder: 0, children: [], metaData: null }])
			expect(custom.getDefinitions()['var_a'].collectionId).toBe('col1')

			custom.replaceCollections([])

			expect(custom.getDefinitions()['var_a'].collectionId).toBe(undefined)
			expect(table.data['var_a'].collectionId).toBe(undefined)
		})
	})

	describe('trpc', () => {
		test('watch yields the current state, then updates', async () => {
			const { custom, caller } = createCustomVariables({ existing: makeDef() })

			const subscription = new SubscriptionTester(await caller.watch())
			await subscription.expectValue([{ type: 'init', info: { existing: makeDef() } }])

			custom.createVariable('my_var', 'hello')
			await subscription.expectValue([
				{ type: 'update', itemId: 'my_var', info: makeDef({ defaultValue: 'hello', sortOrder: 1 }) },
			])

			custom.deleteVariable('my_var')
			await subscription.expectValue([{ type: 'remove', itemId: 'my_var' }])

			await subscription.cleanup()
		})

		test('mutations are exposed', async () => {
			const { custom, caller } = createCustomVariables()

			await expect(caller.create({ name: 'my_var', defaultVal: 'x' })).resolves.toBe(null)
			expect(custom.hasCustomVariable('my_var')).toBe(true)

			await expect(caller.setCurrent({ name: 'my_var', value: 'current' })).resolves.toBe(null)
			expect(custom.getValue('my_var')).toBe('current')

			await caller.delete({ name: 'my_var' })
			expect(custom.hasCustomVariable('my_var')).toBe(false)
		})
	})
})
