import path from 'node:path'
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import { exprVal } from '@companion-app/shared/Model/Options.js'
import nodeVersions from '../../../assets/nodejs-versions.json' with { type: 'json' }
import fixtureVersions from './modules/fixture-versions.json' with { type: 'json' }
import { createTestApp, stubbedNodeRuntimes, type TestApp } from './TestApp.js'

// Spawning real module child processes is slower than the other suites: the first boot also
// provisions node runtimes and thread bundles
vi.setConfig({ testTimeout: 60_000, hookTimeout: 120_000 })

const FIXTURES_DIR = path.join(import.meta.dirname, 'modules/fixtures')
const INVALID_FIXTURES_DIR = path.join(import.meta.dirname, 'modules/fixtures-invalid')

function fixtureModuleId(apiVersion: string): string {
	return `test-module-${apiVersion.replaceAll('.', '-')}`
}

describe('real module children across module-api versions', () => {
	// The app is shared: all versions run side by side in one companion, like real installs do
	let app: TestApp
	beforeAll(async () => {
		app = await createTestApp({ configDir: null, extraModulePath: FIXTURES_DIR })
	})
	afterAll(async () => {
		await app.close()
	})

	async function waitForStatusCategory(connectionId: string, category: string): Promise<void> {
		await vi.waitFor(
			() => {
				expect(app.registry.instance.status.getInstanceStatus(connectionId)?.category).toBe(category)
			},
			{ timeout: 30_000 }
		)
	}

	test.each(fixtureVersions.versions.map((v, index) => ({ ...v, index })))(
		'module built with @companion-module/base@$apiVersion works end to end',
		async ({ apiVersion, runtime, index }) => {
			const label = `mod_${apiVersion.replaceAll('.', '_')}`

			// The module was discovered from the extra-module-path, so it can be added as a connection
			const connectionId = await app
				.trpc()
				.instances.connections.add({ module: { type: fixtureModuleId(apiVersion) }, label, versionId: 'dev' })
			expect(connectionId).toBeTruthy()

			// The child process spawns, registers and initialises. The status turns 'good' when the
			// module reports ok during its init, slightly before the host marks the child ready - and
			// an action executed in that window is silently dropped - so wait for readiness too
			await waitForStatusCategory(connectionId, 'good')
			await vi.waitFor(() => {
				expect(app.registry.instance.processManager.getConnectionChild(connectionId)).toBeTruthy()
			}, 30_000)

			// Its definitions arrive at the host
			await vi.waitFor(() => {
				expect(
					app.registry.instance.definitions.getEntityDefinition(EntityModelType.Action, connectionId, 'set_var')
				).toBeTruthy()
				expect(
					app.registry.instance.definitions.getEntityDefinition(EntityModelType.Feedback, connectionId, 'last_value_is')
				).toBeTruthy()
			}, 30_000)

			// The child runs on exactly the node version its manifest requests. When the real runtime
			// hasn't been fetched (yarn fetch-runtimes) the harness stubs it with the test host's node,
			// so only the stub's version can be expected then
			const expectedNodeVersion = stubbedNodeRuntimes.has(runtime)
				? process.versions.node
				: (nodeVersions as Record<string, string>)[runtime]
			await vi.waitFor(() => {
				expect(app.registry.variables.values.getVariableValue(label, 'node_version')).toBe(expectedNodeVersion)
			}, 30_000)

			// Executing an action in the child updates the module's variables in the host
			const location = { pageNumber: 1, row: 1 + Math.floor(index / 6), column: 1 + (index % 6) }
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
				entityDefinition: 'set_var',
			})
			expect(actionId).toBeTruthy()
			expect(
				await app.trpc().controls.entities.setOption({
					controlId,
					entityLocation: { stepId, setId: 'down' },
					entityId: actionId!,
					key: 'value',
					value: exprVal('hello'),
				})
			).toBe(true)

			const feedbackId = await app.trpc().controls.entities.add({
				controlId,
				entityLocation: 'feedbacks',
				ownerId: null,
				connectionId,
				entityType: EntityModelType.Feedback,
				entityDefinition: 'last_value_is',
			})
			expect(feedbackId).toBeTruthy()
			expect(
				await app.trpc().controls.entities.setOption({
					controlId,
					entityLocation: 'feedbacks',
					entityId: feedbackId!,
					key: 'value',
					value: exprVal('hello'),
				})
			).toBe(true)

			// The option value must be visible on the host-side entity before pressing
			expect(control.entities.findEntityById(actionId!)?.asEntityModel(false).options.value).toEqual(exprVal('hello'))

			app.pressButton(location, true)
			app.pressButton(location, false)
			// The round trip through the child process can be slow when the whole suite runs in
			// parallel, so these waits need more than the default 1s
			await vi.waitFor(() => {
				expect(app.registry.variables.values.getVariableValue(label, 'last_value')).toBe('hello')
				expect(app.registry.variables.values.getVariableValue(label, 'run_count')).toBe(1)
			}, 30_000)

			// The feedback re-evaluated in the child and its value reached the control
			await vi.waitFor(() => {
				expect(app.getFeedbackValue(controlId, feedbackId!)).toBe(true)
			}, 30_000)

			// A config update reaches the module, which reports the new prefix back as a variable
			expect(
				await app.trpc().instances.connections.setConfig({ connectionId, label, config: { prefix: 'P-' } })
			).toBeNull()
			await vi.waitFor(() => {
				expect(app.registry.variables.values.getVariableValue(label, 'prefix')).toBe('P-')
			}, 30_000)

			// And the updated config is used by subsequent action runs
			app.pressButton(location, true)
			app.pressButton(location, false)
			await vi.waitFor(() => {
				expect(app.registry.variables.values.getVariableValue(label, 'last_value')).toBe('P-hello')
			}, 30_000)
			await vi.waitFor(() => {
				expect(app.getFeedbackValue(controlId, feedbackId!)).toBe(false)
			}, 30_000)

			// Disable stops the child, re-enable brings it back
			await app.trpc().instances.connections.setEnabled({ connectionId, enabled: false })
			await vi.waitFor(() => {
				expect(app.registry.instance.processManager.getConnectionChild(connectionId)).toBeUndefined()
			}, 30_000)
			await app.trpc().instances.connections.setEnabled({ connectionId, enabled: true })
			await waitForStatusCategory(connectionId, 'good')
		}
	)

	test('all versions stay operational side by side', async () => {
		// Every connection added above is still running in the one app
		for (const { apiVersion } of fixtureVersions.versions) {
			const label = `mod_${apiVersion.replaceAll('.', '_')}`
			const connectionId = app.registry.instance.getIdForLabel(ModuleInstanceType.Connection, label)
			expect(connectionId, label).toBeTruthy()
			expect(app.registry.instance.status.getInstanceStatus(connectionId!)?.category, label).toBe('good')
		}
	})
})

describe('unsupported module-api versions are rejected', () => {
	let app: TestApp
	beforeAll(async () => {
		app = await createTestApp({ configDir: null, extraModulePath: INVALID_FIXTURES_DIR })
	})
	afterAll(async () => {
		await app.close()
	})

	test.each(['test-module-too-old', 'test-module-too-new'])(
		'%s fails with an incompatible status',
		async (moduleId) => {
			const connectionId = await app.trpc().instances.connections.add({
				module: { type: moduleId },
				label: moduleId.replaceAll('-', '_'),
				versionId: 'dev',
			})

			await vi.waitFor(
				() => {
					expect(app.registry.instance.status.getInstanceStatus(connectionId)?.message).toMatch(/Incompatible/)
				},
				{ timeout: 15_000 }
			)
		}
	)
})
