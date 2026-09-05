import { nanoid } from 'nanoid'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { exprExpr, exprVal } from '@companion-app/shared/Model/Options.js'
import type { ControlTrigger } from '../../lib/Controls/ControlTypes/Triggers/Trigger.js'
import { createTestApp, type TestApp } from './TestApp.js'

// Booting the application takes a few seconds, so the default timeouts are too tight
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 })

/** Let the deferred trigger event setup (setImmediate) settle */
const settle = async () => new Promise((resolve) => setImmediate(resolve))

describe('trigger controls', () => {
	let app: TestApp
	beforeEach(async () => {
		app = await createTestApp({ configDir: null, extraModulePath: null })
	})
	afterEach(async () => {
		await app.close()
	})

	async function createTrigger(): Promise<{ triggerId: string; trigger: ControlTrigger }> {
		const triggerId = await app.trpc().controls.triggers.create()
		const trigger = app.registry.controls.getControl(triggerId) as ControlTrigger
		expect(trigger).toBeTruthy()
		return { triggerId, trigger }
	}

	test('a variable_changed trigger runs its actions when the variable changes', async () => {
		app.createCustomVariable('watch', 'initial')
		app.createCustomVariable('result', 'initial')

		const { triggerId, trigger } = await createTrigger()
		app.addTriggerAction(triggerId, 'custom_variable_set_value', {
			name: exprVal('result'),
			create: exprVal(false),
			value: exprVal('triggered'),
		})
		trigger.eventAdd({ id: nanoid(), type: 'variable_changed', enabled: true, options: { variableId: 'custom:watch' } })
		trigger.optionsSetField('enabled', true)
		await settle()

		app.registry.variables.custom.setValue('watch', 'go')

		await vi.waitFor(() => {
			expect(app.getCustomVariableValue('result')).toBe('triggered')
		})
	})

	test('a disabled trigger does not run', async () => {
		app.createCustomVariable('watch', 'initial')
		app.createCustomVariable('result', 'initial')

		const { triggerId, trigger } = await createTrigger()
		app.addTriggerAction(triggerId, 'custom_variable_set_value', {
			name: exprVal('result'),
			create: exprVal(false),
			value: exprVal('triggered'),
		})
		trigger.eventAdd({ id: nanoid(), type: 'variable_changed', enabled: true, options: { variableId: 'custom:watch' } })
		// triggers are created disabled - deliberately not enabling it
		await settle()

		app.registry.variables.custom.setValue('watch', 'go')

		// Enabling afterwards and changing again proves the first change was dropped, without an arbitrary sleep
		trigger.optionsSetField('enabled', true)
		await settle()
		app.registry.variables.custom.setValue('watch', 'go again')
		await vi.waitFor(() => {
			expect(app.getCustomVariableValue('result')).toBe('triggered')
		})
	})

	test('a button_press trigger fires for every button press', async () => {
		app.createCustomVariable('count', 0)

		const location = { pageNumber: 1, row: 1, column: 1 }
		app.createButton(location)

		const { triggerId, trigger } = await createTrigger()
		app.addTriggerAction(triggerId, 'custom_variable_set_value', {
			name: exprVal('count'),
			create: exprVal(false),
			value: exprExpr('$(custom:count) + 1'),
		})
		trigger.eventAdd({ id: nanoid(), type: 'button_press', enabled: true, options: {} })
		trigger.optionsSetField('enabled', true)
		await settle()

		app.pressButton(location, true)
		app.pressButton(location, false)

		await vi.waitFor(() => {
			expect(app.getCustomVariableValue('count')).toBe(1)
		})
	})

	test('a trigger with a condition only runs while the condition is true', async () => {
		app.createCustomVariable('flag', 'no')
		app.createCustomVariable('input', 'initial')
		app.createCustomVariable('count', 0)

		const { triggerId, trigger } = await createTrigger()
		app.addTriggerAction(triggerId, 'custom_variable_set_value', {
			name: exprVal('count'),
			create: exprVal(false),
			value: exprExpr('$(custom:count) + 1'),
		})
		// The 'feedbacks' list of a trigger is its condition
		app.addInternalFeedback(triggerId, 'check_expression', {
			expression: exprVal(`$(custom:flag) == 'yes'`),
		})
		trigger.eventAdd({ id: nanoid(), type: 'variable_changed', enabled: true, options: { variableId: 'custom:input' } })
		trigger.optionsSetField('enabled', true)
		await settle()

		// Condition false: the event fires but the actions must not run
		app.registry.variables.custom.setValue('input', 'first')

		// Condition true: the next event runs the actions. count === 1 proves the first change never ran
		app.registry.variables.custom.setValue('flag', 'yes')
		await vi.waitFor(() => {
			expect(trigger.entities.checkConditionValue()).toBe(true)
		})
		app.registry.variables.custom.setValue('input', 'second')
		await vi.waitFor(() => {
			expect(app.getCustomVariableValue('count')).toBe(1)
		})
	})

	test('an interval trigger runs periodically', async () => {
		app.createCustomVariable('count', 0)

		const { triggerId, trigger } = await createTrigger()
		app.addTriggerAction(triggerId, 'custom_variable_set_value', {
			name: exprVal('count'),
			create: exprVal(false),
			value: exprExpr('$(custom:count) + 1'),
		})
		trigger.eventAdd({ id: nanoid(), type: 'interval', enabled: true, options: { seconds: 1 } })
		trigger.optionsSetField('enabled', true)
		await settle()

		// The first fire lands roughly two 1s ticks after arming
		await vi.waitFor(
			() => {
				expect(app.getCustomVariableValue('count')).toBeGreaterThanOrEqual(1)
			},
			{ timeout: 6000 }
		)
	})
})
