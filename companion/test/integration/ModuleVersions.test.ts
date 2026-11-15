import dgram from 'node:dgram'
import path from 'node:path'
import semver from 'semver'
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import { exprExpr, exprVal } from '@companion-app/shared/Model/Options.js'
import nodeVersions from '../../../assets/nodejs-versions.json' with { type: 'json' }
import { resolveNodeJsRuntime } from '../../lib/Instance/NodePath.js'
import fixtureVersions from './modules/fixture-versions.json' with { type: 'json' }
import { hasApiFeature } from './modules/src/api-gates.js'
import { createTestApp, getFreeUdpPort, type TestApp } from './TestApp.js'

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
		async ({ apiVersion, contract, runtime, index }) => {
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

			// The child runs on exactly the node version its manifest requests, or what that runtime is aliased to
			const expectedNodeVersion = (nodeVersions as Record<string, string>)[resolveNodeJsRuntime(runtime)]
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

			if (contract === 'v2') {
				// The execution context reaches connection action options as $(this:*) variables. Only
				// 2.x modules accept expressions in their options
				expect(
					await app.trpc().controls.setOptionsField({
						controlId,
						change: { controlType: 'button-layered', key: 'rotaryActions', value: true },
					})
				).toBe(true)
				const rotateLocation = { stepId, setId: 'rotate_right' } as const
				const rotateActionId = await app.trpc().controls.entities.add({
					controlId,
					entityLocation: rotateLocation,
					ownerId: null,
					connectionId,
					entityType: EntityModelType.Action,
					entityDefinition: 'set_var',
				})
				expect(rotateActionId).toBeTruthy()
				expect(
					await app.trpc().controls.entities.setOption({
						controlId,
						entityLocation: rotateLocation,
						entityId: rotateActionId!,
						key: 'value',
						value: exprExpr('`d=${$(this:delta)} s=${$(this:surface_id)}`'),
					})
				).toBe(true)

				app.rotateButton(location, 3)
				await vi.waitFor(() => {
					expect(app.registry.variables.values.getVariableValue(label, 'last_value')).toBe('P-d=3 s=test-surface')
				}, 30_000)

				// A variable read by a feedback's options gets the options parsed again and sent to the module
				const wantVariable = `want_${label}`
				app.createCustomVariable(wantVariable, 'nothing yet')
				expect(
					await app.trpc().controls.entities.setOption({
						controlId,
						entityLocation: 'feedbacks',
						entityId: feedbackId!,
						key: 'value',
						value: exprExpr(`$(custom:${wantVariable})`),
					})
				).toBe(true)
				await vi.waitFor(() => {
					expect(app.getFeedbackValue(controlId, feedbackId!)).toBe(false)
				}, 30_000)

				app.registry.variables.custom.setValue(wantVariable, 'P-d=3 s=test-surface')
				await vi.waitFor(() => {
					expect(app.getFeedbackValue(controlId, feedbackId!)).toBe(true)
				}, 30_000)
			}

			// Behaviours that appeared in a specific api version are registered by the fixture only
			// when its base library supports them - the same feature map drives what to expect here
			if (hasApiFeature(apiVersion, 'shared-udp')) {
				// The module joins a shared udp socket through the host when its config names a port
				const udpPort = await getFreeUdpPort()
				expect(
					await app
						.trpc()
						.instances.connections.setConfig({ connectionId, label, config: { prefix: 'P-', udp_port: udpPort } })
				).toBeNull()
				await vi.waitFor(() => {
					expect(app.registry.variables.values.getVariableValue(label, 'udp_listening')).toBe(String(udpPort))
				}, 30_000)

				const udpSender = dgram.createSocket('udp4')
				try {
					// Datagrams are lossy, so keep sending until one is seen
					await vi.waitFor(
						() => {
							udpSender.send(Buffer.from(`ping-${label}`), udpPort, '127.0.0.1')
							expect(app.registry.variables.values.getVariableValue(label, 'last_udp')).toBe(`ping-${label}`)
						},
						{ timeout: 30_000, interval: 200 }
					)
				} finally {
					udpSender.close()
				}
			} else {
				expect(app.registry.variables.values.getVariableValue(label, 'udp_listening')).toBeUndefined()
			}

			if (hasApiFeature(apiVersion, 'action-result-value')) {
				// The action's returned value is stored where the entity's storeResult points
				const resultActionId = await app.trpc().controls.entities.add({
					controlId,
					entityLocation: { stepId, setId: 'down' },
					ownerId: null,
					connectionId,
					entityType: EntityModelType.Action,
					entityDefinition: 'get_prefixed_value',
				})
				expect(resultActionId).toBeTruthy()
				await app.trpc().controls.entities.setOption({
					controlId,
					entityLocation: { stepId, setId: 'down' },
					entityId: resultActionId!,
					key: 'value',
					value: exprVal('result'),
				})
				expect(
					await app.trpc().controls.entities.setRawStoreResult({
						controlId,
						entityLocation: { stepId, setId: 'down' },
						entityId: resultActionId!,
						target: { type: 'custom-variable', variableName: exprVal(`result_${label}`), createIfNotExists: true },
					})
				).toBe(true)

				// The storeResult target is computed asynchronously after the mutation, so keep
				// pressing until the stored result appears
				await vi.waitFor(
					() => {
						app.pressButton(location, true)
						app.pressButton(location, false)
						expect(app.getCustomVariableValue(`result_${label}`)).toBe('P-result')
					},
					{ timeout: 30_000, interval: 500 }
				)
			} else {
				expect(
					app.registry.instance.definitions.getEntityDefinition(
						EntityModelType.Action,
						connectionId,
						'get_prefixed_value'
					)
				).toBeUndefined()
			}

			// Disable stops the child, re-enable brings it back
			await app.trpc().instances.connections.setEnabled({ connectionId, enabled: false })
			await vi.waitFor(() => {
				expect(app.registry.instance.processManager.getConnectionChild(connectionId)).toBeUndefined()
			}, 30_000)
			await app.trpc().instances.connections.setEnabled({ connectionId, enabled: true })
			await waitForStatusCategory(connectionId, 'good')
		}
	)

	test.each(fixtureVersions.versions.map((v, index) => ({ ...v, index })))(
		'module built with @companion-module/base@$apiVersion is subscribed and learns by the ids it is told about',
		async ({ apiVersion, index }) => {
			const label = `track_${apiVersion.replaceAll('.', '_')}`
			const connectionId = await app
				.trpc()
				.instances.connections.add({ module: { type: fixtureModuleId(apiVersion) }, label, versionId: 'dev' })
			await waitForStatusCategory(connectionId, 'good')
			await vi.waitFor(() => {
				expect(app.registry.instance.processManager.getConnectionChild(connectionId)).toBeTruthy()
				expect(
					app.registry.instance.definitions.getEntityDefinition(EntityModelType.Feedback, connectionId, 'track_fb')
				).toBeTruthy()
			}, 30_000)

			// From 1.13 the host shares one subscription between identical entities in a control, and the module knows
			// them by that. Before then the module knows each entity by its own id
			const sharesSubscriptions = semver.gte(apiVersion, '1.13.0')

			// Rows 1 and 2 hold the buttons of the test above
			const location = { pageNumber: 1, row: 3, column: index }
			const controlId = app.createButton(location)
			const control = app.registry.controls.getControl(controlId)!
			if (!control.supportsEntities || !control.entities.isEditable) throw new Error('Expected an editable button')
			const stepId = (control.entities as unknown as { getStepIds(): string[] }).getStepIds()[0]

			const addEntity = async (
				entityType: EntityModelType,
				entityLocation: 'feedbacks' | { stepId: string; setId: 'down' },
				definitionId: string,
				value: string
			) => {
				const entityId = await app.trpc().controls.entities.add({
					controlId,
					entityLocation,
					ownerId: null,
					connectionId,
					entityType,
					entityDefinition: definitionId,
				})
				if (!entityId) throw new Error('Failed to add the entity')
				await app.trpc().controls.entities.setOption({
					controlId,
					entityLocation,
					entityId,
					key: 'value',
					value: exprVal(value),
				})
				return entityId
			}
			const down = { stepId, setId: 'down' } as const
			const actionIds = [
				await addEntity(EntityModelType.Action, down, 'track', 'a'),
				await addEntity(EntityModelType.Action, down, 'track', 'a'),
				await addEntity(EntityModelType.Action, down, 'track', 'b'),
			]
			const feedbackIds = [
				await addEntity(EntityModelType.Feedback, 'feedbacks', 'track_fb', 'a'),
				await addEntity(EntityModelType.Feedback, 'feedbacks', 'track_fb', 'a'),
				await addEntity(EntityModelType.Feedback, 'feedbacks', 'track_fb', 'b'),
			]

			const trackedIds = (variableId: string) => {
				const value = app.registry.variables.values.getVariableValue(label, variableId)
				return typeof value === 'string' ? value.split(',').filter(Boolean) : []
			}
			for (const [variableId, entityIds] of [
				['tracked_actions', actionIds],
				['tracked_feedbacks', feedbackIds],
			] as const) {
				await vi.waitFor(() => {
					if (sharesSubscriptions) {
						// The identical pair shares one subscription, whose id is not that of either entity
						expect(trackedIds(variableId)).toHaveLength(2)
						expect(trackedIds(variableId).filter((id) => entityIds.includes(id))).toEqual([])
					} else {
						expect(trackedIds(variableId)).toEqual([...entityIds].sort())
					}
				}, 30_000)
			}
			const trackedActions = trackedIds('tracked_actions')
			const trackedFeedbacks = trackedIds('tracked_feedbacks')

			// Learning is by the same id as the module was subscribed with
			const setterLocation = { pageNumber: 1, row: 0, column: index }
			const setterId = app.createButton(setterLocation)
			const setter = app.registry.controls.getControl(setterId)!
			if (!setter.supportsEntities) throw new Error('Expected a button')
			const setterStepId = (setter.entities as unknown as { getStepIds(): string[] }).getStepIds()[0]
			const setVarId = await app.trpc().controls.entities.add({
				controlId: setterId,
				entityLocation: { stepId: setterStepId, setId: 'down' },
				ownerId: null,
				connectionId,
				entityType: EntityModelType.Action,
				entityDefinition: 'set_var',
			})
			await app.trpc().controls.entities.setOption({
				controlId: setterId,
				entityLocation: { stepId: setterStepId, setId: 'down' },
				entityId: setVarId!,
				key: 'value',
				value: exprVal('learnt'),
			})
			app.pressButton(setterLocation, true)
			app.pressButton(setterLocation, false)
			await vi.waitFor(() => {
				expect(app.registry.variables.values.getVariableValue(label, 'last_value')).toBe('learnt')
			}, 30_000)

			expect(
				await app.trpc().controls.entities.learnOptions({ controlId, entityLocation: down, entityId: actionIds[0] })
			).toBe(true)
			expect(control.entities.findEntityById(actionIds[0])?.asEntityModel(false).options.value).toEqual(
				exprVal('learnt')
			)
			// The module reports it as a variable, which can arrive after the learnt options
			await vi.waitFor(() => {
				const learnedId = app.registry.variables.values.getVariableValue(label, 'learned_id')
				if (sharesSubscriptions) {
					expect(trackedActions).toContain(learnedId)
				} else {
					expect(learnedId).toBe(actionIds[0])
				}
			}, 30_000)

			expect(
				await app
					.trpc()
					.controls.entities.learnOptions({ controlId, entityLocation: 'feedbacks', entityId: feedbackIds[0] })
			).toBe(true)
			expect(control.entities.findEntityById(feedbackIds[0])?.asEntityModel(false).options.value).toEqual(
				exprVal('learnt')
			)
			// The module reports it as a variable, which can arrive after the learnt options
			await vi.waitFor(() => {
				const learnedFeedbackId = app.registry.variables.values.getVariableValue(label, 'learned_feedback_id')
				if (sharesSubscriptions) {
					expect(trackedFeedbacks).toContain(learnedFeedbackId)
				} else {
					expect(learnedFeedbackId).toBe(feedbackIds[0])
				}
			}, 30_000)

			// The learnt feedback has moved to a subscription of its own, and is told the value for it
			await vi.waitFor(() => expect(app.getFeedbackValue(controlId, feedbackIds[0])).toBe(true), 30_000)
			expect(app.getFeedbackValue(controlId, feedbackIds[1])).toBe(false)
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
