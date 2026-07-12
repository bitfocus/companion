import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { VariablesController } from '../../lib/Variables/Controller.js'
import { FakeDataDatabase } from '../utils/FakeTableView.js'
import { mockUserConfig } from '../utils/MockUserConfig.js'

const userconfig = mockUserConfig({ timezone: '' })

describe('VariablesController', () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})
	afterEach(() => {
		vi.useRealTimers()
	})

	test('wires the custom variables to the values store', () => {
		const controller = new VariablesController(new FakeDataDatabase().asDataDatabase(), userconfig)

		expect(controller.values).toBeTruthy()
		expect(controller.definitions).toBeTruthy()

		controller.custom.createVariable('my_var', 'hello')
		expect(controller.values.getCustomVariableValue('my_var')).toBe('hello')
	})

	test('creates the trpc router', () => {
		const controller = new VariablesController(new FakeDataDatabase().asDataDatabase(), userconfig)

		expect(controller.createTrpcRouter()).toBeTruthy()
	})
})
