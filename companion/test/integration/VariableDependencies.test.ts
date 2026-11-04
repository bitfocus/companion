import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { CreatePageControlId, type SomeControlId } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { exprVal } from '@companion-app/shared/Model/Options.js'
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

		const location = { pageNumber: 1, row: 3, column: 1 }
		const controlId = app.createButton(location)
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
				change: { controlType: 'button-layered', key: 'stepExpression', value: '$(custom:step)' },
			})
		).toBe(true)
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
