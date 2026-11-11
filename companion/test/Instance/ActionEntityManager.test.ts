import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CreateBankControlId } from '@companion-app/shared/ControlId.js'
import {
	EntityModelType,
	type ActionEntityModel,
	type ReplaceableActionEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import type { ActionEntityManager } from '../../lib/Instance/Connection/ActionEntityManager.js'
import type {
	EntityManagerEntity,
	EntityManagerUpgradeEntity,
} from '../../lib/Instance/Connection/EntityManagerBase.js'
import { VariableDependencyRegistry } from '../../lib/Variables/DependencyRegistry.js'
import {
	createActionManager,
	createMockEntity,
	mockAdapter,
	mockControl,
	mockControlsController,
	mockRenderClock,
	mockVariablesParser,
	resetEntityManagerMocks,
} from './EntityManagerTestHelpers.js'

describe('ActionEntityManager', () => {
	let actionManager: ActionEntityManager
	let variableDependencies: VariableDependencyRegistry

	/**
	 * An entry of an update payload, keyed by the id of the subscription the entity is in
	 */
	const subscriptionEntry = (
		payload: EntityManagerEntity<ActionEntityModel>
	): [string, EntityManagerEntity<ActionEntityModel>] => [actionManager.getSubscriptionId(payload.entity.id)!, payload]

	beforeEach(() => {
		resetEntityManagerMocks()

		variableDependencies = new VariableDependencyRegistry()
		actionManager = createActionManager(variableDependencies)

		vi.useFakeTimers()
	})

	describe('trackEntity', () => {
		it('should add an entity to the tracker', () => {
			const mockEntity = {
				id: 'entity-1',
				type: EntityModelType.Action,
				definitionId: 'action-1',
				asEntityModel: vi.fn().mockReturnValue({
					id: 'entity-1',
					type: EntityModelType.Action,
					definitionId: 'action-1',
					connectionId: 'connection-1',
					options: {},
				}),
				getEntityDefinition: vi.fn().mockReturnValue({
					hasLifecycleFunctions: true,
					options: [],
					optionsToIgnoreForSubscribe: [],
				}),
			}

			actionManager.start(5)
			actionManager.trackEntity(mockEntity as any, CreateBankControlId('control-1'))

			// Verify the entity is being processed
			vi.runAllTimers()

			expect(mockAdapter.updateFeedbacks).not.toHaveBeenCalled()
			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map<string, EntityManagerEntity<ActionEntityModel> | null>([
					subscriptionEntry({
						controlId: CreateBankControlId('control-1'),
						entity: {
							id: 'entity-1',
							type: EntityModelType.Action,
							definitionId: 'action-1',
							connectionId: 'connection-1',
							options: {},
						} as any,
						parsedOptions: {},
					} satisfies EntityManagerEntity<ActionEntityModel>),
				])
			)
		})

		it('should replace existing entity with the same ID', () => {
			const mockEntity1 = {
				id: 'entity-1',
				type: EntityModelType.Action,
				definitionId: 'action-1',
				asEntityModel: vi.fn().mockReturnValue({
					id: 'entity-1',
					type: EntityModelType.Action,
					definitionId: 'action-1',
					connectionId: 'connection-1',
					options: { replaced: false },
				}),
				getEntityDefinition: vi.fn().mockReturnValue({
					hasLifecycleFunctions: true,
					options: [{ id: 'replaced', type: 'checkbox' }],
					optionsToIgnoreForSubscribe: [],
				}),
			}

			const mockEntity2 = {
				id: 'entity-1',
				type: EntityModelType.Action,
				definitionId: 'action-1',
				asEntityModel: vi.fn().mockReturnValue({
					id: 'entity-1',
					type: EntityModelType.Action,
					definitionId: 'action-1',
					connectionId: 'connection-1',
					options: { replaced: true },
				}),
				getEntityDefinition: vi.fn().mockReturnValue({
					hasLifecycleFunctions: true,
					options: [{ id: 'replaced', type: 'checkbox' }],
					optionsToIgnoreForSubscribe: [],
				}),
			}

			// The parsed options are the raw options, so that the replacement parses differently
			mockVariablesParser.parseEntityOptions.mockImplementation((_entityDefinition, options) => ({
				ok: true,
				parsedOptions: options,
				referencedVariableIds: new Set(),
			}))

			actionManager.start(5)
			actionManager.trackEntity(mockEntity1 as any, CreateBankControlId('control-1'))

			// Clear calls from first entity
			vi.runAllTimers()
			mockAdapter.updateActions.mockClear()
			const subscriptionId = actionManager.getSubscriptionId('entity-1')!

			// Track replacement entity
			actionManager.trackEntity(mockEntity2 as any, CreateBankControlId('control-1'))
			vi.runAllTimers()

			// Verify the replacement was processed, updating its subscription in place
			expect(mockEntity2.asEntityModel).toHaveBeenCalled()
			expect(actionManager.getSubscriptionId('entity-1')).toBe(subscriptionId)
			expect(mockAdapter.updateFeedbacks).not.toHaveBeenCalled()
			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map<string, EntityManagerEntity<ActionEntityModel> | null>([
					subscriptionEntry({
						controlId: CreateBankControlId('control-1'),
						entity: {
							id: 'entity-1',
							type: EntityModelType.Action,
							definitionId: 'action-1',
							connectionId: 'connection-1',
							options: { replaced: true },
						} as any,
						parsedOptions: { replaced: true },
					} satisfies EntityManagerEntity<ActionEntityModel>),
				])
			)
		})
	})

	describe('forgetEntity', () => {
		it('should mark entity for deletion', () => {
			const mockEntity = {
				id: 'entity-1',
				type: EntityModelType.Action,
				definitionId: 'action-1',
				asEntityModel: vi.fn().mockReturnValue({
					id: 'entity-1',
					type: EntityModelType.Action,
					definitionId: 'action-1',
					connectionId: 'connection-1',
					options: {},
				}),
				getEntityDefinition: vi.fn().mockReturnValue({
					hasLifecycleFunctions: true,
					options: [],
					optionsToIgnoreForSubscribe: [],
				}),
			}

			actionManager.start(5)
			actionManager.trackEntity(mockEntity as any, CreateBankControlId('control-1'))
			vi.runAllTimers()
			mockAdapter.updateActions.mockClear()
			const subscriptionId = actionManager.getSubscriptionId('entity-1')!

			actionManager.forgetEntity('entity-1')
			vi.runAllTimers()

			// Should have been called with null for the subscription of the entity
			expect(mockAdapter.updateFeedbacks).not.toHaveBeenCalled()
			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map<string, EntityManagerEntity<ActionEntityModel> | null>([[subscriptionId, null]])
			)
		})

		it('should not tell the module about an entity forgotten before it was subscribed', () => {
			const mockEntity = {
				id: 'entity-1',
				type: EntityModelType.Action,
				definitionId: 'action-1',
				asEntityModel: vi.fn().mockReturnValue({
					id: 'entity-1',
					type: EntityModelType.Action,
					definitionId: 'action-1',
					connectionId: 'connection-1',
					options: {},
				}),
				getEntityDefinition: vi.fn().mockReturnValue({
					hasLifecycleFunctions: true,
					options: [],
					optionsToIgnoreForSubscribe: [],
				}),
			}

			actionManager.start(5)
			actionManager.trackEntity(mockEntity as any, CreateBankControlId('control-1'))
			actionManager.forgetEntity('entity-1')
			vi.runAllTimers()

			expect(mockAdapter.updateActions).not.toHaveBeenCalled()
			expect(mockAdapter.updateFeedbacks).not.toHaveBeenCalled()
		})

		it('should do nothing if entity does not exist', () => {
			actionManager.start(5)
			actionManager.forgetEntity('non-existent')

			vi.runAllTimers()

			expect(mockAdapter.updateFeedbacks).not.toHaveBeenCalled()
			expect(mockAdapter.updateActions).not.toHaveBeenCalled()
		})
	})

	describe('onVariablesChanged', () => {
		it('should invalidate entities that reference changed variables', () => {
			// Setup an entity that references variables
			const mockEntity = {
				id: 'entity-1',
				type: EntityModelType.Action,
				definitionId: 'action-1',
				upgradeIndex: 5,
				asEntityModel: vi.fn().mockReturnValue({
					id: 'entity-1',
					type: EntityModelType.Action,
					definitionId: 'action-1',
					connectionId: 'connection-1',
					options: { field1: '$(var:test)' },
				}),
				getEntityDefinition: vi.fn().mockReturnValue({
					hasLifecycleFunctions: true,
					options: [{ id: 'field1', type: 'textinput', useVariables: true }],
					optionsToIgnoreForSubscribe: [],
				}),
			}

			// Add entity to manager
			actionManager.start(5)
			actionManager.trackEntity(mockEntity as any, CreateBankControlId('control-1'))

			// Process the entity so it references variables
			vi.runAllTimers()
			mockAdapter.updateActions.mockClear()

			// Simulate variables changing, so that the entity parses to something else
			mockVariablesParser.parseEntityOptions.mockImplementation(() => ({
				ok: true,
				parsedOptions: { field1: 'new-value' },
				referencedVariableIds: new Set(['var1']),
			}))
			variableDependencies.dispatch(new Set(['var1']), null)
			vi.runAllTimers()

			// Verify it triggered a re-process, updating the subscription in place
			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map<string, EntityManagerEntity<ActionEntityModel> | null>([
					subscriptionEntry({
						controlId: CreateBankControlId('control-1'),
						entity: {
							id: 'entity-1',
							type: EntityModelType.Action,
							definitionId: 'action-1',
							connectionId: 'connection-1',
							options: { field1: '$(var:test)' },
						} as any,
						parsedOptions: { field1: 'new-value' },
					} satisfies EntityManagerEntity<ActionEntityModel>),
				])
			)
		})

		it('should not resend an entity which re-parses to the same options', () => {
			const mockEntity = {
				id: 'entity-1',
				type: EntityModelType.Action,
				definitionId: 'action-1',
				upgradeIndex: 5,
				asEntityModel: vi.fn().mockReturnValue({
					id: 'entity-1',
					type: EntityModelType.Action,
					definitionId: 'action-1',
					connectionId: 'connection-1',
					options: { field1: '$(var:test)' },
				}),
				getEntityDefinition: vi.fn().mockReturnValue({
					hasLifecycleFunctions: true,
					options: [{ id: 'field1', type: 'textinput', useVariables: true }],
					optionsToIgnoreForSubscribe: [],
				}),
			}

			actionManager.start(5)
			actionManager.trackEntity(mockEntity as any, CreateBankControlId('control-1'))
			vi.runAllTimers()
			mockAdapter.updateActions.mockClear()

			variableDependencies.dispatch(new Set(['var1']), null)
			vi.runAllTimers()

			// It was re-parsed, but nothing changed for the module
			expect(mockVariablesParser.parseEntityOptions).toHaveBeenCalledTimes(2)
			expect(mockAdapter.updateActions).not.toHaveBeenCalled()
		})

		it('should not invalidate entities if changed variables are not referenced', () => {
			// Setup an entity that references variables
			const mockEntity = {
				id: 'entity-1',
				type: EntityModelType.Action,
				definitionId: 'action-1',
				upgradeIndex: 5,
				asEntityModel: vi.fn().mockReturnValue({
					id: 'entity-1',
					type: EntityModelType.Action,
					definitionId: 'action-1',
					connectionId: 'connection-1',
					options: { field1: '$(var:test)' },
				}),
				getEntityDefinition: vi.fn().mockReturnValue({
					hasLifecycleFunctions: true,
					options: [{ id: 'field1', type: 'textinput', useVariables: true }],
					optionsToIgnoreForSubscribe: [],
				}),
			}

			// Customize parseEntityOptions to return specific variables
			mockVariablesParser.parseEntityOptions.mockImplementation((_entityDefinition, options) => ({
				ok: true,
				parsedOptions: options,
				referencedVariableIds: new Set(['specific-var']),
			}))

			// Add entity to manager
			actionManager.start(5)
			actionManager.trackEntity(mockEntity as any, CreateBankControlId('control-1'))

			// Process the entity so it references variables
			vi.runAllTimers()
			mockAdapter.updateActions.mockClear()

			// Simulate unrelated variables changing
			variableDependencies.dispatch(new Set(['unrelated-var']), null)
			vi.runAllTimers()

			// Should not have triggered a re-process
			expect(mockAdapter.updateActions).not.toHaveBeenCalled()
			expect(mockAdapter.updateFeedbacks).not.toHaveBeenCalled()
		})

		it('should only invalidate entities on the specified control when controlId is provided', () => {
			// Setup entities on different controls that reference the same variables
			const mockEntity1 = {
				id: 'entity-1',
				type: EntityModelType.Action,
				definitionId: 'action-1',
				upgradeIndex: 5,
				asEntityModel: vi.fn().mockReturnValue({
					id: 'entity-1',
					type: EntityModelType.Action,
					definitionId: 'action-1',
					connectionId: 'connection-1',
					options: { field1: '$(var:test)' },
				}),
				getEntityDefinition: vi.fn().mockReturnValue({
					hasLifecycleFunctions: true,
					options: [{ id: 'field1', type: 'textinput', useVariables: true }],
					optionsToIgnoreForSubscribe: [],
				}),
			}

			const mockEntity2 = {
				id: 'entity-2',
				type: EntityModelType.Action,
				definitionId: 'action-2',
				upgradeIndex: 5,
				asEntityModel: vi.fn().mockReturnValue({
					id: 'entity-2',
					type: EntityModelType.Action,
					definitionId: 'action-2',
					connectionId: 'connection-1',
					options: { field1: '$(var:test)' },
				}),
				getEntityDefinition: vi.fn().mockReturnValue({
					hasLifecycleFunctions: true,
					options: [{ id: 'field1', type: 'textinput', useVariables: true }],
					optionsToIgnoreForSubscribe: [],
				}),
			}

			// Both entities reference 'var1' and 'var2'
			mockVariablesParser.parseEntityOptions.mockImplementation((_entityDefinition, options) => ({
				ok: true,
				parsedOptions: options,
				referencedVariableIds: new Set(['var1', 'var2']),
			}))

			// Add entities to manager on different controls
			actionManager.start(5)
			actionManager.trackEntity(mockEntity1 as any, CreateBankControlId('control-1'))
			actionManager.trackEntity(mockEntity2 as any, CreateBankControlId('control-2'))

			// Process the entities
			vi.runAllTimers()
			mockAdapter.updateActions.mockClear()

			// Simulate variables changing for only control-1, so that its entity parses to something else
			mockVariablesParser.parseEntityOptions.mockImplementation(() => ({
				ok: true,
				parsedOptions: { field1: 'changed' },
				referencedVariableIds: new Set(['var1', 'var2']),
			}))
			variableDependencies.dispatch(new Set(['var1']), new Set([CreateBankControlId('control-1')]))
			vi.runAllTimers()

			// Should only have triggered a re-process for entity-1
			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map<string, EntityManagerEntity<ActionEntityModel> | null>([
					subscriptionEntry({
						controlId: CreateBankControlId('control-1'),
						entity: {
							id: 'entity-1',
							type: EntityModelType.Action,
							definitionId: 'action-1',
							connectionId: 'connection-1',
							options: { field1: '$(var:test)' },
						} as any,
						parsedOptions: { field1: 'changed' },
					} satisfies EntityManagerEntity<ActionEntityModel>),
				])
			)
			expect(mockAdapter.updateFeedbacks).not.toHaveBeenCalled()
		})
	})

	describe('Entity upgrade process', () => {
		it('should send entity for upgrade when upgradeIndex is different', () => {
			// Create entity with older upgrade index
			const mockEntity = {
				id: 'entity-1',
				type: EntityModelType.Action,
				definitionId: 'action-1',
				upgradeIndex: 3, // Lower than the current index (5)
				asEntityModel: vi.fn().mockReturnValue({
					id: 'entity-1',
					type: EntityModelType.Action,
					definitionId: 'action-1',
					connectionId: 'connection-1',
					options: {},
					upgradeIndex: 3,
				}),
				getEntityDefinition: vi.fn().mockReturnValue({
					hasLifecycleFunctions: true,
					options: [],
					optionsToIgnoreForSubscribe: [],
				}),
			}

			actionManager.start(5)
			actionManager.trackEntity(mockEntity as any, CreateBankControlId('control-1'))

			vi.runAllTimers()

			// Should have called upgradeActionsAndFeedbacks
			expect(mockAdapter.upgradeFeedbacks).not.toHaveBeenCalled()
			expect(mockAdapter.upgradeActions).toHaveBeenCalledWith(
				[
					{
						controlId: CreateBankControlId('control-1'),
						entity: {
							id: 'entity-1',
							type: EntityModelType.Action,
							definitionId: 'action-1',
							connectionId: 'connection-1',
							options: {},
							upgradeIndex: 3,
						},
					} satisfies EntityManagerUpgradeEntity<ActionEntityModel>,
				],
				5
			)
		})

		it('should update entity with upgraded version when upgrade completes', async () => {
			// Create entity with older upgrade index
			const mockEntity = {
				id: 'entity-1',
				type: EntityModelType.Action,
				definitionId: 'action-1',
				upgradeIndex: 3,
				asEntityModel: vi.fn().mockReturnValue({
					id: 'entity-1',
					type: EntityModelType.Action,
					definitionId: 'action-1',
					connectionId: 'connection-1',
					options: { old: { isExpression: false, value: true } },
					upgradeIndex: 3,
				}),
				getEntityDefinition: vi.fn().mockReturnValue({
					hasLifecycleFunctions: true,
					options: [],
					optionsToIgnoreForSubscribe: [],
				}),
			}

			// Mock the control
			const mockControl = {
				entities: {
					entityReplaceForUpgrade: vi.fn(),
				},
				supportsEntities: true,
			}
			mockControlsController.getControl.mockReturnValue(mockControl)

			// Setup the upgrade response
			mockAdapter.upgradeActions.mockImplementationOnce(async () => {
				return [
					{
						id: 'entity-1',
						type: EntityModelType.Action,
						definitionId: 'action-1',
						options: { upgraded: { isExpression: false, value: true } },
						upgradeIndex: 5,
					},
				] satisfies ReplaceableActionEntityModel[]
			})

			actionManager.start(5)
			actionManager.trackEntity(mockEntity as any, CreateBankControlId('control-1'))

			// Run timers to trigger the initial process
			vi.runAllTimers()

			// Wait for the Promise microtasks to resolve
			await vi.runAllTimersAsync()

			// Verify that the entityReplaceForUpgrade was called with the upgraded entity
			expect(mockControl.entities.entityReplaceForUpgrade).toHaveBeenCalledWith(
				expect.objectContaining({
					id: 'entity-1',
					type: EntityModelType.Action,
					definitionId: 'action-1',
					options: { upgraded: { isExpression: false, value: true } },
					upgradeIndex: 5,
				})
			)
		})
	})

	describe('render clock', () => {
		it('does not follow the render clock (actions are excluded)', () => {
			expect(mockRenderClock.subscribe).not.toHaveBeenCalled()
		})
	})

	describe('destroy', () => {
		it('should clear entities and set ready to false', () => {
			const mockEntity = {
				id: 'entity-1',
				type: EntityModelType.Action,
				definitionId: 'action-1',
				asEntityModel: vi.fn(),
				getEntityDefinition: vi.fn().mockReturnValue({
					hasLifecycleFunctions: true,
					options: [],
					optionsToIgnoreForSubscribe: [],
				}),
			}

			actionManager.start(5)
			actionManager.trackEntity(mockEntity as any, CreateBankControlId('control-1'))

			actionManager.destroy()

			// After destroy, tracking a new entity should not call processing
			mockAdapter.updateActions.mockClear()
			mockAdapter.updateFeedbacks.mockClear()
			actionManager.trackEntity(mockEntity as any, CreateBankControlId('control-1'))
			vi.runAllTimers()

			expect(mockAdapter.updateActions).not.toHaveBeenCalled()
			expect(mockAdapter.updateFeedbacks).not.toHaveBeenCalled()
		})
	})

	describe('Error Handling', () => {
		it('should handle errors during entity upgrading gracefully', async () => {
			// Mock an entity with older upgrade index
			const mockEntity = {
				id: 'entity-1',
				type: EntityModelType.Action,
				definitionId: 'action-1',
				upgradeIndex: 3,
				asEntityModel: vi.fn().mockReturnValue({
					id: 'entity-1',
					type: EntityModelType.Action,
					definitionId: 'action-1',
					connectionId: 'connection-1',
					options: { old: true },
					upgradeIndex: 3,
				}),
				getEntityDefinition: vi.fn().mockReturnValue({
					hasLifecycleFunctions: true,
					options: [],
					optionsToIgnoreForSubscribe: [],
				}),
			}

			// Setup the ipc to reject with an error
			mockAdapter.updateActions.mockRejectedValueOnce(new Error('Upgrade failed'))
			mockAdapter.updateFeedbacks.mockRejectedValueOnce(new Error('Upgrade failed'))
			mockAdapter.upgradeActions.mockRejectedValueOnce(new Error('Upgrade failed'))
			mockAdapter.upgradeFeedbacks.mockRejectedValueOnce(new Error('Upgrade failed'))

			actionManager.start(5)
			actionManager.trackEntity(mockEntity as any, CreateBankControlId('control-1'))

			// Run timer to trigger the entity tracking
			vi.runAllTimers()

			// Wait for the Promise microtasks to resolve
			await vi.runAllTimersAsync()

			// Should still allow other operations to continue
			const mockEntity2 = {
				id: 'entity-2',
				type: EntityModelType.Action,
				definitionId: 'action-2',
				upgradeIndex: 5, // current version
				asEntityModel: vi.fn().mockReturnValue({
					id: 'entity-2',
					type: EntityModelType.Action,
					definitionId: 'action-2',
					connectionId: 'connection-1',
					options: {},
					upgradeIndex: 5,
				}),
				getEntityDefinition: vi.fn().mockReturnValue({
					hasLifecycleFunctions: true,
					options: [],
					optionsToIgnoreForSubscribe: [],
				}),
			}

			mockAdapter.updateActions.mockClear()
			mockAdapter.updateFeedbacks.mockClear()
			actionManager.trackEntity(mockEntity2 as any, CreateBankControlId('control-1'))
			vi.runAllTimers()

			// New entities should still be processed
			expect(mockAdapter.updateFeedbacks).not.toHaveBeenCalled()
			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map<string, EntityManagerEntity<ActionEntityModel> | null>([
					subscriptionEntry({
						controlId: CreateBankControlId('control-1'),
						entity: {
							id: 'entity-2',
							type: EntityModelType.Action,
							definitionId: 'action-2',
							connectionId: 'connection-1',
							options: {},
							upgradeIndex: 5,
						} as any,
						parsedOptions: {},
					} satisfies EntityManagerEntity<ActionEntityModel>),
				])
			)
		})

		it('should mark entity as inactive when parseEntityOptions returns ok: false', () => {
			// Setup parseEntityOptions to return ok: false with option errors
			const failParse = () => ({
				ok: false,
				optionErrors: { field1: 'Invalid expression syntax' },
				referencedVariableIds: new Set(['test:num']),
			})
			mockVariablesParser.parseEntityOptions.mockImplementationOnce(failParse)

			const mockEntity = {
				id: 'entity-1',
				type: EntityModelType.Action,
				definitionId: 'action-1',
				upgradeIndex: 5,
				asEntityModel: vi.fn().mockReturnValue({
					id: 'entity-1',
					type: EntityModelType.Action,
					definitionId: 'action-1',
					connectionId: 'connection-1',
					options: { field1: { isExpression: true, value: 'invalid expression (' } },
					upgradeIndex: 5,
				}),
				getEntityDefinition: vi.fn().mockReturnValue({
					hasLifecycleFunctions: true,
					options: [{ id: 'field1', type: 'textinput', isExpression: true }],
					optionsToIgnoreForSubscribe: [],
					optionsSupportExpressions: true,
				}),
			}

			actionManager.start(5)
			actionManager.trackEntity(mockEntity as any, CreateBankControlId('control-1'))
			vi.runAllTimers()

			// It was never subscribed, so the module doesn't need to be told
			expect(mockAdapter.updateActions).not.toHaveBeenCalled()

			// Once it parses, it is subscribed
			actionManager.trackEntity(mockEntity as any, CreateBankControlId('control-1'))
			vi.runAllTimers()
			const subscriptionId = actionManager.getSubscriptionId('entity-1')!
			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map([[subscriptionId, expect.objectContaining({ parsedOptions: { field1: 'value-0' } })]])
			)
			mockAdapter.updateActions.mockClear()

			// When it fails to parse again, it is marked as inactive by removing its subscription
			mockVariablesParser.parseEntityOptions.mockImplementationOnce(failParse)
			actionManager.trackEntity(mockEntity as any, CreateBankControlId('control-1'))
			vi.runAllTimers()
			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map<string, EntityManagerEntity<ActionEntityModel> | null>([[subscriptionId, null]])
			)
		})

		it('should mark entity as inactive when parseEntityOptions throws an error', () => {
			// Setup parseEntityOptions to throw an error
			const failParse = () => {
				throw new Error('Expression parsing failed')
			}
			mockVariablesParser.parseEntityOptions.mockImplementationOnce(failParse)

			const mockEntity = {
				id: 'entity-1',
				type: EntityModelType.Action,
				definitionId: 'action-1',
				upgradeIndex: 5,
				asEntityModel: vi.fn().mockReturnValue({
					id: 'entity-1',
					type: EntityModelType.Action,
					definitionId: 'action-1',
					connectionId: 'connection-1',
					options: { field1: { isExpression: true, value: 'invalid expression (' } },
					upgradeIndex: 5,
				}),
				getEntityDefinition: vi.fn().mockReturnValue({
					hasLifecycleFunctions: true,
					options: [{ id: 'field1', type: 'textinput', isExpression: true }],
					optionsToIgnoreForSubscribe: [],
					optionsSupportExpressions: true,
				}),
			}

			actionManager.start(5)
			actionManager.trackEntity(mockEntity as any, CreateBankControlId('control-1'))
			vi.runAllTimers()

			// It was never subscribed, so the module doesn't need to be told
			expect(mockAdapter.updateActions).not.toHaveBeenCalled()

			// Once it parses, it is subscribed
			actionManager.trackEntity(mockEntity as any, CreateBankControlId('control-1'))
			vi.runAllTimers()
			const subscriptionId = actionManager.getSubscriptionId('entity-1')!
			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map([[subscriptionId, expect.objectContaining({ parsedOptions: { field1: 'value-0' } })]])
			)
			mockAdapter.updateActions.mockClear()

			// When it fails to parse again, it is marked as inactive by removing its subscription
			mockVariablesParser.parseEntityOptions.mockImplementationOnce(failParse)
			actionManager.trackEntity(mockEntity as any, CreateBankControlId('control-1'))
			vi.runAllTimers()
			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map<string, EntityManagerEntity<ActionEntityModel> | null>([[subscriptionId, null]])
			)
		})

		it('should handle entities with expression options that parse successfully', () => {
			// Setup parseEntityOptions to return parsed expression result
			mockVariablesParser.parseEntityOptions.mockImplementationOnce(() => ({
				ok: true,
				parsedOptions: { field1: 42 },
				referencedVariableIds: new Set(['test:num']),
			}))

			const mockEntity = {
				id: 'entity-1',
				type: EntityModelType.Action,
				definitionId: 'action-1',
				upgradeIndex: 5,
				asEntityModel: vi.fn().mockReturnValue({
					id: 'entity-1',
					type: EntityModelType.Action,
					definitionId: 'action-1',
					connectionId: 'connection-1',
					options: { field1: { isExpression: true, value: '$(test:num) + 1' } },
					upgradeIndex: 5,
				}),
				getEntityDefinition: vi.fn().mockReturnValue({
					hasLifecycleFunctions: true,
					options: [{ id: 'field1', type: 'textinput', isExpression: true }],
					optionsToIgnoreForSubscribe: [],
					optionsSupportExpressions: true,
				}),
			}

			actionManager.start(5)
			actionManager.trackEntity(mockEntity as any, CreateBankControlId('control-1'))
			vi.runAllTimers()

			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map<string, EntityManagerEntity<ActionEntityModel> | null>([
					subscriptionEntry({
						controlId: CreateBankControlId('control-1'),
						entity: {
							id: 'entity-1',
							type: EntityModelType.Action,
							definitionId: 'action-1',
							connectionId: 'connection-1',
							options: { field1: { isExpression: true, value: '$(test:num) + 1' } },
							upgradeIndex: 5,
						},
						parsedOptions: { field1: 42 },
					} satisfies EntityManagerEntity<ActionEntityModel>),
				])
			)
		})

		it('should track referenced variables for entity invalidation with expressions', () => {
			// Setup parseEntityOptions to track specific variables
			mockVariablesParser.parseEntityOptions.mockImplementation(() => ({
				ok: true,
				parsedOptions: { field1: 100 },
				referencedVariableIds: new Set(['test:expr_var']),
			}))

			const mockEntity = {
				id: 'entity-1',
				type: EntityModelType.Action,
				definitionId: 'action-1',
				upgradeIndex: 5,
				asEntityModel: vi.fn().mockReturnValue({
					id: 'entity-1',
					type: EntityModelType.Action,
					definitionId: 'action-1',
					connectionId: 'connection-1',
					options: { field1: { isExpression: true, value: '$(test:expr_var) * 10' } },
					upgradeIndex: 5,
				}),
				getEntityDefinition: vi.fn().mockReturnValue({
					hasLifecycleFunctions: true,
					options: [{ id: 'field1', type: 'textinput', isExpression: true }],
					optionsToIgnoreForSubscribe: [],
					optionsSupportExpressions: true,
				}),
			}

			actionManager.start(5)
			actionManager.trackEntity(mockEntity as any, CreateBankControlId('control-1'))
			vi.runAllTimers()

			mockAdapter.updateActions.mockClear()

			// Trigger variable change for the referenced variable
			variableDependencies.dispatch(new Set(['test:expr_var']), null)
			vi.runAllTimers()

			// Should have triggered a re-process because the expression variable changed
			expect(mockVariablesParser.parseEntityOptions).toHaveBeenCalledTimes(2)
		})

		it('should not invalidate entity when unrelated variables change with expressions', () => {
			// Setup parseEntityOptions to track specific variables
			mockVariablesParser.parseEntityOptions.mockImplementation(() => ({
				ok: true,
				parsedOptions: { field1: 100 },
				referencedVariableIds: new Set(['test:expr_var']),
			}))

			const mockEntity = {
				id: 'entity-1',
				type: EntityModelType.Action,
				definitionId: 'action-1',
				upgradeIndex: 5,
				asEntityModel: vi.fn().mockReturnValue({
					id: 'entity-1',
					type: EntityModelType.Action,
					definitionId: 'action-1',
					connectionId: 'connection-1',
					options: { field1: { isExpression: true, value: '$(test:expr_var) * 10' } },
					upgradeIndex: 5,
				}),
				getEntityDefinition: vi.fn().mockReturnValue({
					hasLifecycleFunctions: true,
					options: [{ id: 'field1', type: 'textinput', isExpression: true }],
					optionsToIgnoreForSubscribe: [],
					optionsSupportExpressions: true,
				}),
			}

			actionManager.start(5)
			actionManager.trackEntity(mockEntity as any, CreateBankControlId('control-1'))
			vi.runAllTimers()

			mockAdapter.updateActions.mockClear()

			// Trigger variable change for an unrelated variable
			variableDependencies.dispatch(new Set(['other:unrelated_var']), null)
			vi.runAllTimers()

			// Should NOT have triggered a re-process
			expect(mockAdapter.updateActions).not.toHaveBeenCalled()
		})
	})

	describe('Performance', () => {
		it('should handle multiple concurrent entity operations efficiently', () => {
			actionManager.start(5)

			// Create a large number of entities
			const entityCount = 25
			const mockEntities: any[] = []

			for (let i = 0; i < entityCount; i++) {
				const mockEntity = {
					id: `entity-${i}`,
					type: EntityModelType.Action,
					definitionId: `def-${i}`,
					upgradeIndex: 5,
					asEntityModel: vi.fn().mockReturnValue({
						id: `entity-${i}`,
						type: EntityModelType.Action,
						definitionId: `def-${i}`,
						connectionId: 'connection-1',
						options: { index: { isExpression: false, value: i } },
						upgradeIndex: 5,
					}),
					getEntityDefinition: vi.fn().mockReturnValue({
						hasLifecycleFunctions: true,
						options: [{ id: 'index', type: 'number' }],
						optionsToIgnoreForSubscribe: [],
					}),
				}
				mockEntities.push(mockEntity)
			}

			// Track all entities with their own control IDs
			mockEntities.forEach((entity, i) => {
				actionManager.trackEntity(entity, CreateBankControlId(`control-${i}`))
			})

			// Run debounced function
			vi.runAllTimers()

			const payload: Map<string, EntityManagerEntity<ActionEntityModel> | null> =
				mockAdapter.updateActions.mock.calls[0][0]

			// Should have every entity
			expect(payload.size).toBe(entityCount)

			// Check a specific entity
			expect(payload.get(actionManager.getSubscriptionId('entity-1')!)).toEqual({
				controlId: CreateBankControlId('control-1'),
				entity: {
					id: 'entity-1',
					type: EntityModelType.Action,
					definitionId: 'def-1',
					connectionId: 'connection-1',
					options: { index: { isExpression: false, value: 1 } },
					upgradeIndex: 5,
				},
				parsedOptions: { index: 'value-0' },
			} satisfies EntityManagerEntity<ActionEntityModel>)
		})

		it('should limit the number of update batches in flight at once', async () => {
			// Make updateActions hang so that batches stay in flight until we release them
			const releases: Array<() => void> = []
			mockAdapter.updateActions.mockImplementation(
				async () =>
					new Promise<void>((resolve) => {
						releases.push(resolve)
					})
			)

			actionManager.start(5)

			// Enough actions to require more than the in-flight limit of batches (batch size is 50)
			const entityCount = 350
			for (let i = 0; i < entityCount; i++) {
				const mockEntity = {
					id: `entity-${i}`,
					type: EntityModelType.Action,
					definitionId: `def-${i}`,
					upgradeIndex: 5,
					asEntityModel: vi.fn().mockReturnValue({
						id: `entity-${i}`,
						type: EntityModelType.Action,
						definitionId: `def-${i}`,
						connectionId: 'connection-1',
						options: {},
						upgradeIndex: 5,
					}),
					getEntityDefinition: vi.fn().mockReturnValue({
						hasLifecycleFunctions: true,
						options: [],
						optionsToIgnoreForSubscribe: [],
					}),
				}
				actionManager.trackEntity(mockEntity as any, CreateBankControlId(`control-${i}`))
			}

			vi.runAllTimers()

			// Only the in-flight limit worth of batches should have been sent so far
			expect(mockAdapter.updateActions).toHaveBeenCalledTimes(5)

			// Release the in-flight batches (and let subsequently-started ones resolve immediately),
			// which should drain the rest of the queue
			mockAdapter.updateActions.mockResolvedValue(undefined)
			releases.forEach((release) => release())
			await vi.runAllTimersAsync()

			// All batches should have been sent, and it must have taken more than one round
			const totalEntitiesSent = mockAdapter.updateActions.mock.calls.reduce((sum, [payload]) => sum + payload.size, 0)
			expect(mockAdapter.updateActions.mock.calls.length).toBeGreaterThan(5)
			expect(totalEntitiesSent).toBe(entityCount)
		})
	})

	describe('Race Conditions', () => {
		it('should handle entity state transitions during asynchronous operations', async () => {
			// Create a delayed IPC response
			let resolvePromise: (value: any) => void
			const delayedPromise = new Promise((resolve) => {
				resolvePromise = resolve
			})

			mockAdapter.updateActions.mockReturnValueOnce(delayedPromise)

			// Create an entity that needs upgrading
			const mockEntity = {
				id: 'entity-1',
				type: EntityModelType.Action,
				definitionId: 'action-1',
				upgradeIndex: 3,
				asEntityModel: vi.fn().mockReturnValue({
					id: 'entity-1',
					type: EntityModelType.Action,
					definitionId: 'action-1',
					connectionId: 'connection-1',
					options: {},
					upgradeIndex: 3,
				}),
				getEntityDefinition: vi.fn().mockReturnValue({
					hasLifecycleFunctions: true,
					options: [],
					optionsToIgnoreForSubscribe: [],
				}),
			}

			actionManager.start(5)
			actionManager.trackEntity(mockEntity as any, CreateBankControlId('control-1'))

			// Run initial process
			vi.runAllTimers()

			// Now forget the entity while the upgrade is in progress
			actionManager.forgetEntity('entity-1')

			// Now complete the upgrade
			resolvePromise!({
				updatedActions: [
					{
						id: 'entity-1',
						actionId: 'action-1',
						options: { upgraded: true },
						upgradeIndex: 5,
					},
				],
				updatedFeedbacks: [],
			})

			// Wait for the Promise to resolve
			await vi.runAllTimersAsync()

			// The entity should not get updated in the control since it was deleted
			expect(mockControl.entities.entityReplaceForUpgrade).not.toHaveBeenCalled()
		})
	})

	describe('Page Controller Integration', () => {
		it('should get control locations from page controller when parsing variables', () => {
			const mockEntity = {
				id: 'entity-1',
				type: EntityModelType.Action,
				definitionId: 'action-1',
				upgradeIndex: 5,
				asEntityModel: vi.fn().mockReturnValue({
					id: 'entity-1',
					type: EntityModelType.Action,
					definitionId: 'action-1',
					connectionId: 'connection-1',
					options: { field1: '$(var:page_specific)' },
				}),
				getEntityDefinition: vi.fn().mockReturnValue({
					hasLifecycleFunctions: true,
					options: [{ id: 'field1', type: 'textinput', useVariables: true }],
					optionsToIgnoreForSubscribe: [],
				}),
			}

			actionManager.start(5)
			actionManager.trackEntity(mockEntity as any, CreateBankControlId('control-1'))
			vi.runAllTimers()

			// Should have passed the location to parse variables
			expect(mockControlsController.createVariablesAndExpressionParser).toHaveBeenCalledWith(
				CreateBankControlId('control-1'),
				null
			)
			expect(mockVariablesParser.parseEntityOptions).toHaveBeenCalled()
		})
	})

	describe('Edge Cases', () => {
		it('should handle entities with missing entity definition', () => {
			const mockEntity = {
				id: 'entity-1',
				type: EntityModelType.Action,
				definitionId: 'action-1',
				upgradeIndex: 5,
				asEntityModel: vi.fn().mockReturnValue({
					id: 'entity-1',
					type: EntityModelType.Action,
					definitionId: 'action-1',
					connectionId: 'connection-1',
					options: { field1: 'value1' },
				}),
				getEntityDefinition: vi.fn().mockReturnValue(null),
			}

			actionManager.start(5)
			actionManager.trackEntity(mockEntity as any, CreateBankControlId('control-1'))

			// Should skip the entity since there's no entity definition
			vi.runAllTimers()

			expect(mockAdapter.updateActions).not.toHaveBeenCalled()
		})

		it('should skip entities without lifecycle functions', () => {
			const mockEntity = {
				id: 'entity-1',
				type: EntityModelType.Action,
				definitionId: 'action-1',
				upgradeIndex: 5,
				asEntityModel: vi.fn().mockReturnValue({
					id: 'entity-1',
					type: EntityModelType.Action,
					definitionId: 'action-1',
					connectionId: 'connection-1',
					options: { field1: 'value1' },
				}),
				getEntityDefinition: vi.fn().mockReturnValue({
					hasLifecycleFunctions: false,
					options: [],
					optionsToIgnoreForSubscribe: [],
				}),
			}

			actionManager.start(5)
			actionManager.trackEntity(mockEntity as any, CreateBankControlId('control-1'))

			// Should skip the entity since it doesn't have lifecycle functions
			vi.runAllTimers()

			expect(mockAdapter.updateActions).not.toHaveBeenCalled()
		})

		it('should handle mixed entities - some with lifecycle functions, some without', () => {
			const mockEntityWithLifecycle = {
				id: 'entity-with-lifecycle',
				type: EntityModelType.Action,
				definitionId: 'action-1',
				upgradeIndex: 5,
				asEntityModel: vi.fn().mockReturnValue({
					id: 'entity-with-lifecycle',
					type: EntityModelType.Action,
					definitionId: 'action-1',
					connectionId: 'connection-1',
					options: {},
				}),
				getEntityDefinition: vi.fn().mockReturnValue({
					hasLifecycleFunctions: true,
					options: [],
					optionsToIgnoreForSubscribe: [],
				}),
			}

			const mockEntityWithoutLifecycle = {
				id: 'entity-without-lifecycle',
				type: EntityModelType.Action,
				definitionId: 'action-2',
				upgradeIndex: 5,
				asEntityModel: vi.fn().mockReturnValue({
					id: 'entity-without-lifecycle',
					type: EntityModelType.Action,
					definitionId: 'action-2',
					connectionId: 'connection-1',
					options: {},
				}),
				getEntityDefinition: vi.fn().mockReturnValue({
					hasLifecycleFunctions: false,
					options: [],
					optionsToIgnoreForSubscribe: [],
				}),
			}

			actionManager.start(5)
			actionManager.trackEntity(mockEntityWithLifecycle as any, CreateBankControlId('control-1'))
			actionManager.trackEntity(mockEntityWithoutLifecycle as any, CreateBankControlId('control-2'))

			vi.runAllTimers()

			// Only the entity with lifecycle functions should be sent to the module
			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map<string, EntityManagerEntity<ActionEntityModel> | null>([
					subscriptionEntry({
						controlId: CreateBankControlId('control-1'),
						entity: {
							id: 'entity-with-lifecycle',
							type: EntityModelType.Action,
							definitionId: 'action-1',
							connectionId: 'connection-1',
							options: {},
						} as any,
						parsedOptions: {},
					} satisfies EntityManagerEntity<ActionEntityModel>),
				])
			)

			// Should only be called once (for the entity with lifecycle functions)
			expect(mockAdapter.updateActions).toHaveBeenCalledTimes(1)
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledTimes(0)
		})

		it('should not subscribe a disabled entity to the module', () => {
			const mockEntity = {
				id: 'entity-1',
				type: EntityModelType.Action,
				definitionId: 'action-1',
				disabled: true,
				upgradeIndex: 5,
				asEntityModel: vi.fn().mockReturnValue({
					id: 'entity-1',
					type: EntityModelType.Action,
					definitionId: 'action-1',
					connectionId: 'connection-1',
					options: {},
					upgradeIndex: 5,
					disabled: true,
				}),
				getEntityDefinition: vi.fn().mockReturnValue({
					hasLifecycleFunctions: true,
					options: [],
					optionsToIgnoreForSubscribe: [],
				}),
			}

			actionManager.start(5)
			actionManager.trackEntity(mockEntity as any, CreateBankControlId('control-1'))

			vi.runAllTimers()

			expect(mockAdapter.updateActions).not.toHaveBeenCalled()
			expect(mockAdapter.updateFeedbacks).not.toHaveBeenCalled()
			expect(mockAdapter.upgradeActions).not.toHaveBeenCalled()
			expect(mockAdapter.upgradeFeedbacks).not.toHaveBeenCalled()
		})

		it('should run upgrade scripts for a disabled entity that is out of date', async () => {
			const mockEntity = {
				id: 'entity-1',
				type: EntityModelType.Action,
				definitionId: 'action-1',
				disabled: true,
				upgradeIndex: 3, // Lower than the current index (5)
				asEntityModel: vi.fn().mockReturnValue({
					id: 'entity-1',
					type: EntityModelType.Action,
					definitionId: 'action-1',
					connectionId: 'connection-1',
					options: {},
					upgradeIndex: 3,
					disabled: true,
				}),
				getEntityDefinition: vi.fn().mockReturnValue({
					hasLifecycleFunctions: true,
					options: [],
					optionsToIgnoreForSubscribe: [],
				}),
			}

			actionManager.start(5)
			actionManager.trackEntity(mockEntity as any, CreateBankControlId('control-1'))

			vi.runAllTimers()

			// Upgrade should be sent
			expect(mockAdapter.upgradeActions).toHaveBeenCalledWith(
				[
					{
						controlId: CreateBankControlId('control-1'),
						entity: {
							id: 'entity-1',
							type: EntityModelType.Action,
							definitionId: 'action-1',
							connectionId: 'connection-1',
							options: {},
							upgradeIndex: 3,
							disabled: true,
						},
					} satisfies EntityManagerUpgradeEntity<ActionEntityModel>,
				],
				5
			)

			// But no subscribe should follow
			expect(mockAdapter.updateActions).not.toHaveBeenCalled()
			expect(mockAdapter.updateFeedbacks).not.toHaveBeenCalled()
		})

		it('should skip upgrading entities without lifecycle functions even with old upgradeIndex', async () => {
			const mockEntityWithoutLifecycle = {
				id: 'entity-without-lifecycle',
				type: EntityModelType.Action,
				definitionId: 'action-1',
				upgradeIndex: 3, // Older than current index (5), but should still be skipped
				asEntityModel: vi.fn().mockReturnValue({
					id: 'entity-without-lifecycle',
					type: EntityModelType.Action,
					definitionId: 'action-1',
					connectionId: 'connection-1',
					options: {},
					upgradeIndex: 3,
				}),
				getEntityDefinition: vi.fn().mockReturnValue({
					hasLifecycleFunctions: false,
					options: [],
					optionsToIgnoreForSubscribe: [],
				}),
			}

			actionManager.start(5)
			actionManager.trackEntity(mockEntityWithoutLifecycle as any, CreateBankControlId('control-1'))

			vi.runAllTimers()
			await vi.runAllTimersAsync()

			// Should call upgradeActionsAndFeedbacks first, but then ignore the result
			expect(mockAdapter.upgradeActions).toHaveBeenCalledWith(
				[
					{
						controlId: CreateBankControlId('control-1'),
						entity: {
							id: 'entity-without-lifecycle',
							type: EntityModelType.Action,
							definitionId: 'action-1',
							connectionId: 'connection-1',
							options: {},
							upgradeIndex: 3,
						},
					} satisfies EntityManagerUpgradeEntity<ActionEntityModel>,
				],
				5
			)

			// Should only be called once (for upgrade), not for regular processing
			expect(mockAdapter.upgradeActions).toHaveBeenCalledTimes(1)
			expect(mockAdapter.upgradeFeedbacks).toHaveBeenCalledTimes(0)
		})

		it('should send null to module when entity transitions from enabled to disabled', () => {
			const mockEntity = {
				id: 'entity-1',
				type: EntityModelType.Action,
				definitionId: 'action-1',
				disabled: false,
				upgradeIndex: 5,
				asEntityModel: vi.fn().mockReturnValue({
					id: 'entity-1',
					type: EntityModelType.Action,
					definitionId: 'action-1',
					connectionId: 'connection-1',
					options: {},
					upgradeIndex: 5,
					disabled: false,
				}),
				getEntityDefinition: vi.fn().mockReturnValue({
					hasLifecycleFunctions: true,
					options: [],
					optionsToIgnoreForSubscribe: [],
				}),
			}

			actionManager.start(5)
			actionManager.trackEntity(mockEntity as any, CreateBankControlId('control-1'))
			vi.runAllTimers()

			// Entity is subscribed
			const subscriptionId = actionManager.getSubscriptionId('entity-1')!
			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map<string, EntityManagerEntity<ActionEntityModel> | null>([
					[subscriptionId, expect.objectContaining({ controlId: CreateBankControlId('control-1') })],
				])
			)

			mockAdapter.updateActions.mockClear()

			// Entity becomes disabled — forgetEntity is called
			actionManager.forgetEntity('entity-1')
			vi.runAllTimers()

			// Module should be told to unsubscribe (null)
			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map<string, EntityManagerEntity<ActionEntityModel> | null>([[subscriptionId, null]])
			)
		})

		it('should subscribe to module when entity transitions from disabled to enabled', () => {
			const mockEntity = {
				id: 'entity-1',
				type: EntityModelType.Action,
				definitionId: 'action-1',
				disabled: true,
				upgradeIndex: 5,
				asEntityModel: vi.fn().mockReturnValue({
					id: 'entity-1',
					type: EntityModelType.Action,
					definitionId: 'action-1',
					connectionId: 'connection-1',
					options: {},
					upgradeIndex: 5,
					disabled: true,
				}),
				getEntityDefinition: vi.fn().mockReturnValue({
					hasLifecycleFunctions: true,
					options: [],
					optionsToIgnoreForSubscribe: [],
				}),
			}

			actionManager.start(5)
			actionManager.trackEntity(mockEntity as any, CreateBankControlId('control-1'))
			vi.runAllTimers()

			// Nothing sent while disabled
			expect(mockAdapter.updateActions).not.toHaveBeenCalled()

			// Entity becomes enabled — trackEntity is called with disabled: false
			mockEntity.disabled = false
			mockEntity.asEntityModel.mockReturnValue({
				id: 'entity-1',
				type: EntityModelType.Action,
				definitionId: 'action-1',
				connectionId: 'connection-1',
				options: {},
				upgradeIndex: 5,
				disabled: false,
			})

			actionManager.trackEntity(mockEntity as any, CreateBankControlId('control-1'))
			vi.runAllTimers()

			// Module should now receive the subscription
			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map<string, EntityManagerEntity<ActionEntityModel> | null>([
					subscriptionEntry({
						controlId: CreateBankControlId('control-1'),
						entity: {
							id: 'entity-1',
							type: EntityModelType.Action,
							definitionId: 'action-1',
							connectionId: 'connection-1',
							options: {},
							upgradeIndex: 5,
							disabled: false,
						} as any,
						parsedOptions: {},
					} satisfies EntityManagerEntity<ActionEntityModel>),
				])
			)
		})
	})

	describe('Upgrade states', () => {
		it('should handle entities with varying upgrade states', async () => {
			actionManager.start(5)

			const entities = [
				{
					id: 'entity-1',
					type: EntityModelType.Action,
					definitionId: 'action-1',
					upgradeIndex: 3, // Needs upgrade
					asEntityModel: vi.fn().mockReturnValue({
						id: 'entity-1',
						type: EntityModelType.Action,
						definitionId: 'action-1',
						connectionId: 'connection-1',
						options: {},
						upgradeIndex: 3,
					}),
					getEntityDefinition: vi.fn().mockReturnValue({
						hasLifecycleFunctions: true,
						options: [],
						optionsToIgnoreForSubscribe: [],
					}),
				},
				{
					id: 'entity-2',
					type: EntityModelType.Action,
					definitionId: 'action-2',
					upgradeIndex: 5, // Current version
					asEntityModel: vi.fn().mockReturnValue({
						id: 'entity-2',
						type: EntityModelType.Action,
						definitionId: 'action-2',
						connectionId: 'connection-1',
						options: {},
						upgradeIndex: 5,
					}),
					getEntityDefinition: vi.fn().mockReturnValue({
						hasLifecycleFunctions: true,
						options: [],
						optionsToIgnoreForSubscribe: [],
					}),
				},
			]

			// Setup control mocks for each entity
			mockControlsController.getControl.mockImplementation(() => ({
				...mockControl,
				getBitmapFeedbackSize: vi.fn().mockReturnValue({ width: 72, height: 58 }),
			}))

			// Setup IPC wrapper to return upgrade results
			mockAdapter.upgradeActions.mockImplementationOnce(async () => {
				return [
					{
						id: 'entity-1',
						type: EntityModelType.Action,
						definitionId: 'action-1',
						options: { upgraded: { isExpression: false, value: true } },
						upgradeIndex: 5,
					},
				] satisfies ReplaceableActionEntityModel[]
			})

			// Track all entities
			entities.forEach((entity) => {
				actionManager.trackEntity(entity as any, CreateBankControlId('control-1'))
			})

			vi.runAllTimers()
			await vi.runAllTimersAsync()

			// Should have sent the entity that needs upgrading for upgrade
			expect(mockAdapter.upgradeActions).toHaveBeenCalledWith(
				[
					{
						controlId: CreateBankControlId('control-1'),
						entity: {
							id: 'entity-1',
							type: EntityModelType.Action,
							connectionId: 'connection-1',
							definitionId: 'action-1',
							options: {},
							upgradeIndex: 3,
						},
					},
				] satisfies EntityManagerUpgradeEntity<ActionEntityModel>[],
				5
			)

			// Should have sent the entity that doesn't need upgrading as an update
			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map<string, EntityManagerEntity<ActionEntityModel> | null>([
					[actionManager.getSubscriptionId(entities[1].id)!, expect.anything()],
				])
			)
		})
	})

	describe('Merged subscriptions', () => {
		beforeEach(() => {
			// The parsed options are the raw options, so that entities can be made to differ
			mockVariablesParser.parseEntityOptions.mockImplementation((_entityDefinition, options) => ({
				ok: true,
				parsedOptions: options,
				referencedVariableIds: new Set(['var1']),
			}))

			actionManager.start(5)
		})

		it('should give the same id to identical actions, for executing them', () => {
			const action1 = createMockEntity('action-1', EntityModelType.Action, { field1: 'a' })
			const action2 = createMockEntity('action-2', EntityModelType.Action, { field1: 'a' })

			actionManager.trackEntity(action1 as any, CreateBankControlId('control-1'))
			actionManager.trackEntity(action2 as any, CreateBankControlId('control-1'))
			vi.runAllTimers()

			expect(mockAdapter.updateActions).toHaveBeenCalledTimes(1)
			expect(actionManager.getSubscriptionId('action-1')).toBeDefined()
			expect(actionManager.getSubscriptionId('action-2')).toBe(actionManager.getSubscriptionId('action-1'))
		})

		it('should have no subscription id for an entity which is not subscribed', () => {
			const action = createMockEntity('action-1', EntityModelType.Action, { field1: 'a' })
			action.getEntityDefinition.mockReturnValue({
				hasLifecycleFunctions: false,
				options: [],
				optionsToIgnoreForSubscribe: [],
			})

			actionManager.trackEntity(action as any, CreateBankControlId('control-1'))
			vi.runAllTimers()

			expect(actionManager.getSubscriptionId('action-1')).toBeUndefined()
			expect(actionManager.getSubscriptionId('unknown')).toBeUndefined()
		})

		it('should update the subscription of a sole member in place when its options change', () => {
			const action = createMockEntity('action-1', EntityModelType.Action, { field1: 'a' })
			const actionChanged = createMockEntity('action-1', EntityModelType.Action, { field1: 'b' })

			actionManager.trackEntity(action as any, CreateBankControlId('control-1'))
			vi.runAllTimers()
			mockAdapter.updateActions.mockClear()
			const subscriptionId = actionManager.getSubscriptionId('action-1')!

			actionManager.trackEntity(actionChanged as any, CreateBankControlId('control-1'))
			vi.runAllTimers()

			expect(actionManager.getSubscriptionId('action-1')).toBe(subscriptionId)
			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map([[subscriptionId, expect.objectContaining({ parsedOptions: { field1: 'b' } })]])
			)
		})

		it('should resend unchanged subscriptions when the definitions change', () => {
			const action = createMockEntity('action-1', EntityModelType.Action, { field1: 'a' })

			actionManager.trackEntity(action as any, CreateBankControlId('control-1'))
			vi.runAllTimers()
			mockAdapter.updateActions.mockClear()

			actionManager.onEntityDefinitionsChanged()
			vi.runAllTimers()

			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map([[actionManager.getSubscriptionId('action-1'), expect.anything()]])
			)
		})
	})
})
