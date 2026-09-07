import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { exprVal } from '@companion-app/shared/Model/Options.js'
import { GENERIC_HTTP_3_1_0, isPortalModulePresent, PORTAL_MODULES_DIR } from './modules/fetch-portal-module.mjs'
import { createTestApp, type TestApp } from './TestApp.js'

// Spawns a real module child process, so it needs more than the default timeout. The module itself is
// provisioned ahead of time by `yarn fetch-test-modules` (see the ci workflow), never downloaded here,
// so no network wait rides inside these hooks
vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 })

/*
 * Reproduces https://github.com/bitfocus/companion-module-generic-http/issues/110 against the real
 * generic-http v3.1.0 module pulled from the Bitfocus portal.
 *
 * The module's response actions store the HTTP result into a custom variable chosen by a
 * `custom-variable` option field ("JSON Response Data Variable" / "Response Status Code Variable").
 * The whole loop is self-contained: the module fetches a value from companion's own HTTP API and
 * writes it back into another custom variable, which the test then reads.
 *
 * When those option fields are left at their default (no variable selected), the module receives
 * `undefined` rather than the field's declared `''` default, and its `String(action.options.x)`
 * coercion turns that into the literal string "undefined" - so it writes the response to a custom
 * variable named "undefined". The bug test below pins that down.
 */
describe('generic-http module response variables (issue #110)', () => {
	let app: TestApp
	let connectionId: string

	beforeAll(async () => {
		// The module must already be provisioned (by `yarn fetch-test-modules`, which ci runs before the
		// tests). Fail fast rather than downloading inline, so no network stall can blow the hook timeout.
		if (!(await isPortalModulePresent(GENERIC_HTTP_3_1_0))) {
			throw new Error(
				`The ${GENERIC_HTTP_3_1_0.id} module fixture is missing - run \`yarn fetch-test-modules\` before running these tests`
			)
		}

		app = await createTestApp({ configDir: null, extraModulePath: PORTAL_MODULES_DIR })

		connectionId = await app
			.trpc()
			.instances.connections.add({ module: { type: 'generic-http' }, label: 'http', versionId: 'dev' })
		expect(connectionId).toBeTruthy()

		// Wait for the child to spawn, initialise (status 'good') and become ready, then for its GET
		// action definition to reach the host
		await vi.waitFor(() => {
			expect(app.registry.instance.status.getInstanceStatus(connectionId)?.category).toBe('good')
			expect(app.registry.instance.processManager.getConnectionChild(connectionId)).toBeTruthy()
		}, 30_000)
		await vi.waitFor(() => {
			expect(
				app.registry.instance.definitions.getEntityDefinition(EntityModelType.Action, connectionId, 'get')
			).toBeTruthy()
		}, 30_000)

		// The value the module fetches back from companion's own http api (the app is shared across
		// the tests below, so this is created once)
		app.createCustomVariable('source', 'hello-from-companion')
	})

	afterAll(async () => {
		await app?.close()
	})

	/** Add a generic-http GET action to a button and set the given options on it */
	async function addGetActionWithOptions(
		location: { pageNumber: number; row: number; column: number },
		options: Record<string, string>
	): Promise<{ controlId: string }> {
		const controlId = app.createButton(location)
		const control = app.registry.controls.getControl(controlId)!
		if (!control.supportsEntities || !control.entities.isEditable) throw new Error('Expected an editable button')
		const stepId = (control.entities as unknown as { getStepIds(): string[] }).getStepIds()[0]

		const actionId = await app.trpc().controls.entities.add({
			controlId,
			entityLocation: { stepId, setId: 'down' },
			ownerId: null,
			connectionId,
			entityType: EntityModelType.Action,
			entityDefinition: 'get',
		})
		expect(actionId).toBeTruthy()

		for (const [key, value] of Object.entries(options)) {
			expect(
				await app.trpc().controls.entities.setOption({
					controlId,
					entityLocation: { stepId, setId: 'down' },
					entityId: actionId!,
					key,
					value: exprVal(value),
				})
			).toBe(true)
		}

		return { controlId }
	}

	/** The url of companion's own http endpoint that serves a custom variable's value */
	function customVariableUrl(name: string): string {
		return `http://127.0.0.1:${app.httpPort}/api/custom-variable/${name}/value`
	}

	test('stores the http response into the selected custom variable', async () => {
		app.createCustomVariable('dest', 'initial')

		// The GET action fetches `source` from companion's own http api and, because a response
		// variable is selected, writes the body into `dest`
		await addGetActionWithOptions(
			{ pageNumber: 1, row: 1, column: 1 },
			{ url: customVariableUrl('source'), jsonResultDataVariable: 'dest' }
		)

		app.pressButton({ pageNumber: 1, row: 1, column: 1 }, true)
		app.pressButton({ pageNumber: 1, row: 1, column: 1 }, false)

		await vi.waitFor(() => {
			expect(app.getCustomVariableValue('dest')).toBe('hello-from-companion')
		}, 30_000)
	})

	// Regression test for issue #110. A `custom-variable` option field has no default in companion's
	// model, so a never-touched option would reach the module as `undefined`; generic-http's
	// `String(action.options.jsonResultDataVariable)` then coerces that to the string "undefined" and
	// writes the response to a custom variable of that name. `validateInputValue` now sanitises an unset
	// custom-variable option to '', which is falsy, so the module skips the write.
	test('leaving a response variable at its default does not write to a variable named "undefined"', async () => {
		// A canary that only the bug would touch: the module coerces an unset custom-variable option
		// to the string "undefined", so it would write the status code here
		app.createCustomVariable('undefined', 'untouched')
		app.createCustomVariable('body_dest', 'initial')

		// Select a variable for the body (its write is our completion signal) but leave the status-code
		// variable at its default. generic-http writes the status code first and the body second, so once
		// `body_dest` is set the status-code handling has already run and the canary is in its final state.
		await addGetActionWithOptions(
			{ pageNumber: 1, row: 1, column: 2 },
			{ url: customVariableUrl('source'), jsonResultDataVariable: 'body_dest' }
		)

		app.pressButton({ pageNumber: 1, row: 1, column: 2 }, true)
		app.pressButton({ pageNumber: 1, row: 1, column: 2 }, false)

		await vi.waitFor(() => {
			expect(app.getCustomVariableValue('body_dest')).toBe('hello-from-companion')
		}, 30_000)

		expect(app.getCustomVariableValue('undefined')).toBe('untouched')
	})
})
