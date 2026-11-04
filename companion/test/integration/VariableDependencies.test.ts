import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { CreatePageControlId, type SomeControlId } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { exprExpr, exprVal } from '@companion-app/shared/Model/Options.js'
import type { ControlButtonLayered } from '../../lib/Controls/ControlTypes/Button/Layered.js'
import { createTestApp, type TestApp } from './TestApp.js'

// Booting the application takes a few seconds, so the default timeouts are too tight
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 })

/**
 * A variable change only reaches what read the variable (see VariableDependencyRegistry), so these
 * check each kind of reader is still told, through the real app, and that scoped variables stay scoped.
 */
describe('variable changes reach what reads them', () => {
	let app: TestApp
	beforeEach(async () => {
		app = await createTestApp({ configDir: null, extraModulePath: null })
	})
	afterEach(async () => {
		// createTestApp() may have rejected before assigning, so guard so teardown can't mask that error
		await app?.close()
	})

	async function setText(controlId: SomeControlId, text: string): Promise<void> {
		await app.trpc().controls.styles.updateOption({ controlId, elementId: 'text0', key: 'text', value: exprVal(text) })
	}

	function renderedText(location: ControlLocation): unknown {
		return (app.registry.graphics.getCachedRender(location)?.style as { text?: { text?: unknown } } | undefined)?.text
			?.text
	}

	/** Add an expression local variable, as the webui does */
	async function addExpressionLocalVariable(controlId: SomeControlId, name: string, expression: string): Promise<void> {
		const entityId = await app.trpc().controls.entities.add({
			controlId,
			entityLocation: 'local-variables',
			ownerId: null,
			connectionId: 'internal',
			entityType: EntityModelType.Feedback,
			entityDefinition: 'expression_value',
		})
		if (!entityId) throw new Error('Failed to add local variable')
		await app.trpc().controls.entities.setVariableName({
			controlId,
			entityLocation: 'local-variables',
			entityId,
			name,
		})
		await app.trpc().controls.entities.setOption({
			controlId,
			entityLocation: 'local-variables',
			entityId,
			key: 'expression',
			value: exprVal(expression),
		})
	}

	/** Add a user-value local variable, as the webui does */
	async function addUserLocalVariable(controlId: SomeControlId, name: string): Promise<void> {
		const entityId = await app.trpc().controls.entities.add({
			controlId,
			entityLocation: 'local-variables',
			ownerId: null,
			connectionId: 'internal',
			entityType: EntityModelType.Feedback,
			entityDefinition: 'user_value',
		})
		if (!entityId) throw new Error('Failed to add local variable')
		await app.trpc().controls.entities.setVariableName({
			controlId,
			entityLocation: 'local-variables',
			entityId,
			name,
		})
	}

	/** Make a button's current step follow an expression, returning the control to read the step from */
	async function useStepExpression(controlId: SomeControlId, expression: string): Promise<ControlButtonLayered> {
		const control = app.registry.controls.getControl(controlId) as ControlButtonLayered
		await app.trpc().controls.steps.add({ controlId })

		expect(
			await app.trpc().controls.setOptionsField({
				controlId,
				change: { controlType: 'button-layered', key: 'stepProgression', value: 'expression' },
			})
		).toBe(true)
		expect(
			await app.trpc().controls.setOptionsField({
				controlId,
				change: { controlType: 'button-layered', key: 'stepExpression', value: expression },
			})
		).toBe(true)

		return control
	}

	async function moveButton(fromLocation: ControlLocation, toLocation: ControlLocation): Promise<void> {
		expect(
			await app.trpc().controls.gridBatchTransfer({ operation: 'move', pairs: [{ fromLocation, toLocation }] })
		).toBe(true)
	}

	test('drawn text follows the variables it shows', async () => {
		app.createCustomVariable('label', 'one')

		const location = { pageNumber: 1, row: 1, column: 1 }
		const controlId = app.createButton(location)
		await setText(controlId, 'is $(custom:label)')

		await vi.waitFor(() => expect(renderedText(location)).toBe('is one'))

		app.registry.variables.custom.setValue('label', 'two')
		await vi.waitFor(() => expect(renderedText(location)).toBe('is two'))
	})

	test("a local variable change only reaches its own button's readers", async () => {
		app.createCustomVariable('src_a', 'a1')
		app.createCustomVariable('src_b', 'b1')

		const locationA = { pageNumber: 1, row: 1, column: 1 }
		const locationB = { pageNumber: 1, row: 1, column: 2 }
		const buttonA = app.createButton(locationA)
		const buttonB = app.createButton(locationB)

		// The same local variable name on both, each computed from a different custom variable
		await addExpressionLocalVariable(buttonA, 'n', '$(custom:src_a)')
		await addExpressionLocalVariable(buttonB, 'n', '$(custom:src_b)')
		await setText(buttonA, '$(local:n)')
		await setText(buttonB, '$(local:n)')

		await vi.waitFor(() => {
			expect(renderedText(locationA)).toBe('a1')
			expect(renderedText(locationB)).toBe('b1')
		})

		app.registry.variables.custom.setValue('src_a', 'a2')
		await vi.waitFor(() => expect(renderedText(locationA)).toBe('a2'))
		expect(renderedText(locationB)).toBe('b1')

		app.registry.variables.custom.setValue('src_b', 'b2')
		await vi.waitFor(() => expect(renderedText(locationB)).toBe('b2'))
		expect(renderedText(locationA)).toBe('a2')
	})

	test('a page variable change only reaches the buttons on that page', async () => {
		app.createCustomVariable('page_src', 'p1')
		await app.trpc().pages.insert({ asPageNumber: 2, pageNames: ['Second'] })

		const page1Control = CreatePageControlId(app.registry.page.store.getPageId(1)!)
		expect(app.registry.controls.getControl(page1Control)).toBeTruthy()
		await addExpressionLocalVariable(page1Control, 'shown', '$(custom:page_src)')

		// Page 2 doesn't define it, so its button shows the variable as unknown throughout
		const onPage1 = { pageNumber: 1, row: 2, column: 1 }
		const onPage2 = { pageNumber: 2, row: 2, column: 1 }
		await setText(app.createButton(onPage1), '[$(page:shown)]')
		await setText(app.createButton(onPage2), '[$(page:shown)]')

		await vi.waitFor(() => {
			expect(renderedText(onPage1)).toBe('[p1]')
			expect(renderedText(onPage2)).not.toBe('[p1]')
		})
		const page2Before = renderedText(onPage2)

		app.registry.variables.custom.setValue('page_src', 'p2')
		await vi.waitFor(() => expect(renderedText(onPage1)).toBe('[p2]'))
		expect(renderedText(onPage2)).toBe(page2Before)
	})

	test('a step expression follows the variables it reads', async () => {
		app.createCustomVariable('step', 1)

		const controlId = app.createButton({ pageNumber: 1, row: 3, column: 1 })
		const control = await useStepExpression(controlId, '$(custom:step)')
		expect(control.entities.getActiveStepIndex()).toBe(0)

		app.registry.variables.custom.setValue('step', 2)
		await vi.waitFor(() => expect(control.entities.getActiveStepIndex()).toBe(1))

		app.registry.variables.custom.setValue('step', 1)
		await vi.waitFor(() => expect(control.entities.getActiveStepIndex()).toBe(0))
	})

	test('an internal feedback follows the variables it reads, after its options change', async () => {
		app.createCustomVariable('fb_a', 'yes')
		app.createCustomVariable('fb_b', 'no')

		const controlId = app.createButton({ pageNumber: 1, row: 3, column: 2 })
		const feedbackId = app.addInternalFeedback(controlId, 'check_expression', {
			expression: exprVal(`$(custom:fb_a) == 'yes'`),
		})
		await vi.waitFor(() => expect(app.getFeedbackValue(controlId, feedbackId)).toBe(true))

		// Pointing it at another variable must move what it is told about
		await app.trpc().controls.entities.setOption({
			controlId,
			entityLocation: 'feedbacks',
			entityId: feedbackId,
			key: 'expression',
			value: exprVal(`$(custom:fb_b) == 'yes'`),
		})
		await vi.waitFor(() => expect(app.getFeedbackValue(controlId, feedbackId)).toBe(false))

		app.registry.variables.custom.setValue('fb_a', 'no')
		app.registry.variables.custom.setValue('fb_b', 'yes')
		await vi.waitFor(() => expect(app.getFeedbackValue(controlId, feedbackId)).toBe(true))
	})

	test('a custom variable read by its legacy internal:custom_ name is followed', async () => {
		app.createCustomVariable('legacy', 'old')

		const location = { pageNumber: 1, row: 1, column: 3 }
		await setText(app.createButton(location), '$(internal:custom_legacy)')
		await vi.waitFor(() => expect(renderedText(location)).toBe('old'))

		app.registry.variables.custom.setValue('legacy', 'new')
		await vi.waitFor(() => expect(renderedText(location)).toBe('new'))
	})

	test('a page variable follows the sibling page variable it reads', async () => {
		app.createCustomVariable('sibling_src', 's1')

		const pageControl = CreatePageControlId(app.registry.page.store.getPageId(1)!)
		await addExpressionLocalVariable(pageControl, 'inner', '$(custom:sibling_src)')
		await addExpressionLocalVariable(pageControl, 'outer', '`<${$(page:inner)}>`')

		const location = { pageNumber: 1, row: 2, column: 3 }
		await setText(app.createButton(location), '$(page:outer)')
		await vi.waitFor(() => expect(renderedText(location)).toBe('<s1>'))

		app.registry.variables.custom.setValue('sibling_src', 's2')
		await vi.waitFor(() => expect(renderedText(location)).toBe('<s2>'))
	})

	// A move also clears the drawing and re-subscribes internal feedbacks, so a step expression is what shows
	// the location variables themselves being reported as changed
	test('this: variables follow a button when it moves', async () => {
		const from = { pageNumber: 1, row: 1, column: 4 }
		const to = { pageNumber: 1, row: 2, column: 4 }
		const control = await useStepExpression(app.createButton(from), '$(this:row)')
		expect(control.entities.getActiveStepIndex()).toBe(0)

		await moveButton(from, to)
		await vi.waitFor(() => expect(control.entities.getActiveStepIndex()).toBe(1))
	})

	test('page variables follow a button moved to another page', async () => {
		await app.trpc().pages.insert({ asPageNumber: 2, pageNames: ['Second'] })
		for (const [pageNumber, step] of [
			[1, '1'],
			[2, '2'],
		] as const) {
			const pageControl = CreatePageControlId(app.registry.page.store.getPageId(pageNumber)!)
			await addExpressionLocalVariable(pageControl, 'step', step)
		}

		const from = { pageNumber: 1, row: 1, column: 5 }
		const control = await useStepExpression(app.createButton(from), '$(page:step)')
		await vi.waitFor(() => expect(control.entities.getActiveStepIndex()).toBe(0))

		// Let page 2 announce its new variable first, as the move alone must be what updates the step
		const page2Control = app.registry.controls.getControl(CreatePageControlId(app.registry.page.store.getPageId(2)!))
		await vi.waitFor(() =>
			expect(page2Control?.supportsEntities && page2Control.entities.getLocalVariableEntities()[0]?.feedbackValue).toBe(
				2
			)
		)
		await new Promise((resolve) => setTimeout(resolve, 50))

		await moveButton(from, { pageNumber: 2, row: 1, column: 5 })
		await vi.waitFor(() => expect(control.entities.getActiveStepIndex()).toBe(1))
	})

	test('a feedback inversion expression follows the variables it reads', async () => {
		app.createCustomVariable('invert', 'on')

		const controlId = app.createButton({ pageNumber: 1, row: 3, column: 4 })
		const feedbackId = app.addInternalFeedback(controlId, 'check_expression', { expression: exprVal('true') })
		expect(
			await app.trpc().controls.entities.setInverted({
				controlId,
				entityLocation: 'feedbacks',
				entityId: feedbackId,
				isInverted: exprExpr(`$(custom:invert) == 'on'`),
			})
		).toBe(true)

		const isOn = () =>
			(app.registry.controls.getControl(controlId) as ControlButtonLayered).entities
				.findEntityById(feedbackId)
				?.getBooleanFeedbackValue(null)
		// Inverted from the start, so this waits for the expression to have been evaluated
		await vi.waitFor(() => expect(isOn()).toBe(false))

		app.registry.variables.custom.setValue('invert', 'off')
		await vi.waitFor(() => expect(isOn()).toBe(true))
	})

	test('a condition sees a computed local variable updated earlier in the same run', async () => {
		app.createCustomVariable('result', 'not run')

		const location = { pageNumber: 1, row: 3, column: 5 }
		const controlId = app.createButton(location)
		await addUserLocalVariable(controlId, 'input')
		await addExpressionLocalVariable(controlId, 'doubled', '$(local:input) * 2')

		// In order with no wait between them: the condition must see `doubled` recomputed from the new `input`
		const groupId = app.addInternalAction(controlId, 'action_group', { execution_mode: exprVal('sequential') })
		const inGroup = { parentId: groupId, childGroup: 'default' }
		app.addInternalChildAction(controlId, inGroup, 'local_variable_set_value', {
			location: exprVal('$(this:page)/$(this:row)/$(this:column)'),
			name: exprVal('input'),
			value: exprVal('5'),
		})
		const logicIfId = app.addInternalChildAction(controlId, inGroup, 'logic_if', {})
		app.addInternalChildFeedback(controlId, { parentId: logicIfId, childGroup: 'condition' }, 'check_expression', {
			expression: exprVal('$(local:doubled) == 10'),
		})
		app.addInternalChildAction(controlId, { parentId: logicIfId, childGroup: 'actions' }, 'custom_variable_set_value', {
			name: exprVal('result'),
			create: exprVal(false),
			value: exprVal('ran'),
		})

		app.pressButton(location, true)
		app.pressButton(location, false)
		await vi.waitFor(() => expect(app.getCustomVariableValue('result')).toBe('ran'))
	})

	test('deleting a button stops tracking everything it read', async () => {
		app.createCustomVariable('tracked', 'x')

		const baseline = app.registry.variables.dependencies.stats()

		const location = { pageNumber: 1, row: 3, column: 3 }
		const controlId = app.createButton(location)
		await addExpressionLocalVariable(controlId, 'n', '$(custom:tracked)')
		await setText(controlId, '$(local:n) $(custom:tracked)')
		app.addInternalFeedback(controlId, 'check_expression', { expression: exprVal(`$(custom:tracked) == 'x'`) })

		await vi.waitFor(() => expect(renderedText(location)).toBe('x x'))
		expect(app.registry.variables.dependencies.stats().dependencies).toBeGreaterThan(baseline.dependencies)

		app.registry.controls.deleteControl(controlId)

		// Only compare what a leak would change: what the other controls read can still be settling from boot
		const after = app.registry.variables.dependencies.stats()
		expect({ controls: after.controls, dependencies: after.dependencies, armed: after.armed }).toEqual({
			controls: baseline.controls,
			dependencies: baseline.dependencies,
			armed: baseline.armed,
		})
	})
})
