import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CreateBankControlId } from '@companion-app/shared/ControlId.js'
import {
	EntityModelType,
	type FeedbackEntityModel,
	type ReplaceableFeedbackEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import type {
	EntityManagerEntity,
	EntityManagerUpgradeEntity,
} from '../../lib/Instance/Connection/EntityManagerBase.js'
import type { FeedbackEntityManager } from '../../lib/Instance/Connection/FeedbackEntityManager.js'
import { VariableDependencyRegistry } from '../../lib/Variables/DependencyRegistry.js'
import {
	createActionManager,
	createFeedbackManager,
	createMockEntity,
	mockAdapter,
	mockControl,
	mockControlsController,
	mockRenderClock,
	mockVariablesParser,
	resetEntityManagerMocks,
} from './EntityManagerTestHelpers.js'

describe('FeedbackEntityManager', () => {
	let feedbackManager: FeedbackEntityManager
	let variableDependencies: VariableDependencyRegistry

	/**
	 * An entry of an update payload, keyed by the id of the subscription the entity is in
	 */
	const subscriptionEntry = (
		payload: EntityManagerEntity<FeedbackEntityModel>
	): [string, EntityManagerEntity<FeedbackEntityModel>] => [
		feedbackManager.getSubscriptionId(payload.entity.id)!,
		payload,
	]

	beforeEach(() => {
		resetEntityManagerMocks()

		variableDependencies = new VariableDependencyRegistry()
		feedbackManager = createFeedbackManager(variableDependencies)

		vi.useFakeTimers()
	})

	describe('trackEntity', () => {
		it('should add a feedback entity', () => {
			const mockFeedback = {
				id: 'feedback-1',
				type: EntityModelType.Feedback,
				definitionId: 'feedback-def-1',
				asEntityModel: vi.fn().mockReturnValue({
					id: 'feedback-1',
					type: EntityModelType.Feedback,
					definitionId: 'feedback-def-1',
					connectionId: 'connection-1',
					options: {},
				}),
				getEntityDefinition: vi.fn().mockReturnValue({
					hasLifecycleFunctions: true,
					options: [],
					optionsToIgnoreForSubscribe: [],
				}),
			}

			feedbackManager.start(5)
			feedbackManager.trackEntity(mockFeedback as any, CreateBankControlId('control-1'))

			// Verify the entity is being processed
			vi.runAllTimers()

			expect(mockAdapter.updateActions).not.toHaveBeenCalled()
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledWith(
				new Map<string, EntityManagerEntity<FeedbackEntityModel> | null>([
					subscriptionEntry({
						controlId: CreateBankControlId('control-1'),
						entity: {
							id: 'feedback-1',
							type: EntityModelType.Feedback,
							definitionId: 'feedback-def-1',
							connectionId: 'connection-1',
							options: {},
						} as any,
						parsedOptions: {},
					} satisfies EntityManagerEntity<FeedbackEntityModel>),
				])
			)
		})
	})

	describe('resendFeedbacks', () => {
		it('should reset all feedback entities to unloaded state', () => {
			const mockFeedback = {
				id: 'feedback-1',
				type: EntityModelType.Feedback,
				definitionId: 'feedback-def-1',
				asEntityModel: vi.fn().mockReturnValue({
					id: 'feedback-1',
					type: EntityModelType.Feedback,
					definitionId: 'feedback-def-1',
					connectionId: 'connection-1',
					options: {},
				}),
				getEntityDefinition: vi.fn().mockReturnValue({
					hasLifecycleFunctions: true,
					options: [],
					optionsToIgnoreForSubscribe: [],
				}),
			}

			feedbackManager.start(5)
			feedbackManager.trackEntity(mockFeedback as any, CreateBankControlId('control-1'))

			// First clear the initial processing
			vi.runAllTimers()
			mockAdapter.updateFeedbacks.mockClear()

			// Now resend feedbacks
			feedbackManager.resendFeedbacks()
			vi.runAllTimers()

			expect(mockAdapter.updateActions).not.toHaveBeenCalled()
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledWith(
				new Map<string, EntityManagerEntity<FeedbackEntityModel> | null>([
					subscriptionEntry({
						controlId: CreateBankControlId('control-1'),
						entity: {
							id: 'feedback-1',
							type: EntityModelType.Feedback,
							definitionId: 'feedback-def-1',
							connectionId: 'connection-1',
							options: {},
						} as any,
						parsedOptions: {},
					} satisfies EntityManagerEntity<FeedbackEntityModel>),
				])
			)
		})

		it('should handle entities in various states correctly when resending', () => {
			// Create multiple feedback entities
			const createMockFeedback = (id: string) => ({
				id,
				type: EntityModelType.Feedback,
				definitionId: 'feedback-def-1',
				asEntityModel: vi.fn().mockReturnValue({
					id,
					type: EntityModelType.Feedback,
					definitionId: 'feedback-def-1',
					connectionId: 'connection-1',
					options: {},
				}),
				getEntityDefinition: vi.fn().mockReturnValue({
					hasLifecycleFunctions: true,
					options: [],
					optionsToIgnoreForSubscribe: [],
				}),
			})

			const mockFeedbacks = [
				createMockFeedback('feedback-1'),
				createMockFeedback('feedback-2'),
				createMockFeedback('feedback-3'),
			]

			feedbackManager.start(5)

			// Add all feedbacks
			mockFeedbacks.forEach((fb, i) => {
				feedbackManager.trackEntity(fb as any, CreateBankControlId(`control-${i + 1}`))
			})

			// Process initial state
			vi.runAllTimers()
			mockAdapter.updateFeedbacks.mockClear()
			const feedback2SubscriptionId = feedbackManager.getSubscriptionId('feedback-2')!

			// Force feedback-2 to be forgotten
			feedbackManager.forgetEntity('feedback-2')

			// Now resend feedbacks
			feedbackManager.resendFeedbacks()
			vi.runAllTimers()

			// Should have been called with the appropriate feedbacks
			expect(mockAdapter.updateActions).not.toHaveBeenCalled()
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledWith(
				new Map<string, EntityManagerEntity<FeedbackEntityModel> | null>([
					subscriptionEntry({
						controlId: CreateBankControlId('control-1'),
						entity: {
							id: 'feedback-1',
							type: EntityModelType.Feedback,
							definitionId: 'feedback-def-1',
							connectionId: 'connection-1',
							options: {},
						} as any,
						parsedOptions: {},
					} satisfies EntityManagerEntity<FeedbackEntityModel>),
					[feedback2SubscriptionId, null],
					subscriptionEntry({
						controlId: CreateBankControlId('control-3'),
						entity: {
							id: 'feedback-3',
							type: EntityModelType.Feedback,
							definitionId: 'feedback-def-1',
							connectionId: 'connection-1',
							options: {},
						} as any,
						parsedOptions: {},
					} satisfies EntityManagerEntity<FeedbackEntityModel>),
				])
			)
		})
	})

	describe('onVariablesChanged', () => {
		it('should not invalidate entities on different controls when controlId is provided', () => {
			// Setup entities on different controls
			const mockEntity1 = {
				id: 'entity-1',
				type: EntityModelType.Feedback,
				definitionId: 'feedback-1',
				upgradeIndex: 5,
				asEntityModel: vi.fn().mockReturnValue({
					id: 'entity-1',
					type: EntityModelType.Feedback,
					definitionId: 'feedback-1',
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
				type: EntityModelType.Feedback,
				definitionId: 'feedback-2',
				upgradeIndex: 5,
				asEntityModel: vi.fn().mockReturnValue({
					id: 'entity-2',
					type: EntityModelType.Feedback,
					definitionId: 'feedback-2',
					connectionId: 'connection-1',
					options: { field1: '$(var:test)' },
				}),
				getEntityDefinition: vi.fn().mockReturnValue({
					hasLifecycleFunctions: true,
					options: [{ id: 'field1', type: 'textinput', useVariables: true }],
					optionsToIgnoreForSubscribe: [],
				}),
			}

			// Both entities reference 'control-var'
			mockVariablesParser.parseEntityOptions.mockImplementation((_entityDefinition, options) => ({
				ok: true,
				parsedOptions: options,
				referencedVariableIds: new Set(['control-var']),
			}))

			// Add entities to manager on different controls
			feedbackManager.start(5)
			feedbackManager.trackEntity(mockEntity1 as any, CreateBankControlId('control-1'))
			feedbackManager.trackEntity(mockEntity2 as any, CreateBankControlId('control-2'))

			// Process the entities
			vi.runAllTimers()
			mockAdapter.updateFeedbacks.mockClear()

			// Simulate variables changing for only control-2, so that its entity parses to something else
			mockVariablesParser.parseEntityOptions.mockImplementation(() => ({
				ok: true,
				parsedOptions: { field1: 'changed' },
				referencedVariableIds: new Set(['control-var']),
			}))
			variableDependencies.dispatch(new Set(['control-var']), new Set([CreateBankControlId('control-2')]))
			vi.runAllTimers()

			// Should only have triggered a re-process for entity-2, not entity-1
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledWith(
				new Map<string, EntityManagerEntity<FeedbackEntityModel> | null>([
					subscriptionEntry({
						controlId: CreateBankControlId('control-2'),
						entity: {
							id: 'entity-2',
							type: EntityModelType.Feedback,
							definitionId: 'feedback-2',
							connectionId: 'connection-1',
							options: { field1: '$(var:test)' },
						} as any,
						parsedOptions: { field1: 'changed' },
					} satisfies EntityManagerEntity<FeedbackEntityModel>),
				])
			)
			expect(mockAdapter.updateActions).not.toHaveBeenCalled()
		})

		it('should follow an entity that is re-tracked on a different control', () => {
			const mockEntity = {
				id: 'entity-1',
				type: EntityModelType.Feedback,
				definitionId: 'feedback-1',
				upgradeIndex: 5,
				asEntityModel: vi.fn().mockReturnValue({
					id: 'entity-1',
					type: EntityModelType.Feedback,
					definitionId: 'feedback-1',
					connectionId: 'connection-1',
					options: {},
				}),
				getEntityDefinition: vi.fn().mockReturnValue({
					hasLifecycleFunctions: true,
					options: [],
					optionsToIgnoreForSubscribe: [],
				}),
			}

			mockVariablesParser.parseEntityOptions.mockImplementation((_entityDefinition, options) => ({
				ok: true,
				parsedOptions: options,
				referencedVariableIds: new Set(['control-var']),
			}))

			feedbackManager.start(5)
			feedbackManager.trackEntity(mockEntity as any, CreateBankControlId('control-1'))
			vi.runAllTimers()

			// The entity moves to control-2
			feedbackManager.trackEntity(mockEntity as any, CreateBankControlId('control-2'))
			vi.runAllTimers()
			mockVariablesParser.parseEntityOptions.mockClear()

			// A change scoped to the old control must not invalidate it
			variableDependencies.dispatch(new Set(['control-var']), new Set([CreateBankControlId('control-1')]))
			vi.runAllTimers()
			expect(mockVariablesParser.parseEntityOptions).not.toHaveBeenCalled()

			// A change scoped to the new control must. The options parse the same, so nothing is resent to the module
			variableDependencies.dispatch(new Set(['control-var']), new Set([CreateBankControlId('control-2')]))
			vi.runAllTimers()
			expect(mockVariablesParser.parseEntityOptions).toHaveBeenCalledTimes(1)
			expect(mockVariablesParser.parseEntityOptions).toHaveBeenCalledWith(
				expect.anything(),
				expect.anything(),
				CreateBankControlId('control-2')
			)
		})
	})

	describe('variable dependency tracking', () => {
		const makeFeedback = (id: string) => ({
			id,
			type: EntityModelType.Feedback,
			definitionId: 'feedback-1',
			upgradeIndex: 5,
			asEntityModel: vi.fn().mockReturnValue({
				id,
				type: EntityModelType.Feedback,
				definitionId: 'feedback-1',
				connectionId: 'connection-1',
				options: {},
			}),
			getEntityDefinition: vi.fn().mockReturnValue({
				hasLifecycleFunctions: true,
				options: [],
				optionsToIgnoreForSubscribe: [],
			}),
		})

		it('only registers entities which reference variables', () => {
			mockVariablesParser.parseEntityOptions.mockImplementation((_entityDefinition, options) => ({
				ok: true,
				parsedOptions: options,
				referencedVariableIds: new Set<string>(),
			}))

			feedbackManager.start(5)
			feedbackManager.trackEntity(makeFeedback('entity-1') as any, CreateBankControlId('control-1'))
			vi.runAllTimers()

			expect(variableDependencies.stats().dependencies).toBe(0)
		})

		it('stops tracking a forgotten entity', () => {
			feedbackManager.start(5)
			feedbackManager.trackEntity(makeFeedback('entity-1') as any, CreateBankControlId('control-1'))
			feedbackManager.trackEntity(makeFeedback('entity-2') as any, CreateBankControlId('control-1'))
			vi.runAllTimers()
			expect(variableDependencies.stats().dependencies).toBe(2)

			feedbackManager.forgetEntity('entity-1')
			vi.runAllTimers()
			expect(variableDependencies.stats().dependencies).toBe(1)
		})

		it('replaces the tracking of a re-tracked entity', () => {
			feedbackManager.start(5)
			const entity = makeFeedback('entity-1')
			feedbackManager.trackEntity(entity as any, CreateBankControlId('control-1'))
			vi.runAllTimers()
			feedbackManager.trackEntity(entity as any, CreateBankControlId('control-1'))
			vi.runAllTimers()

			expect(variableDependencies.stats().dependencies).toBe(1)
		})

		it('stops tracking everything when destroyed', () => {
			feedbackManager.start(5)
			feedbackManager.trackEntity(makeFeedback('entity-1') as any, CreateBankControlId('control-1'))
			feedbackManager.trackEntity(makeFeedback('entity-2') as any, CreateBankControlId('control-2'))
			vi.runAllTimers()

			mockAdapter.updateFeedbacks.mockClear()

			feedbackManager.destroy()
			expect(variableDependencies.stats()).toEqual({ keys: 0, controls: 0, dependencies: 0, armed: 0 })

			// Nothing is sent to a module being shut down
			variableDependencies.dispatch(new Set(['var1']), null)
			vi.runAllTimers()
			expect(mockAdapter.updateFeedbacks).not.toHaveBeenCalled()
		})

		it('follows a re-parse that reads different variables', () => {
			feedbackManager.start(5)
			feedbackManager.trackEntity(makeFeedback('entity-1') as any, CreateBankControlId('control-1'))
			vi.runAllTimers()

			// The next parse, prompted by a change to what it read, reads something else
			mockVariablesParser.parseEntityOptions.mockImplementation((_entityDefinition, options) => ({
				ok: true,
				parsedOptions: options,
				referencedVariableIds: new Set(['other-var']),
			}))
			variableDependencies.dispatch(new Set(['var1']), null)
			vi.runAllTimers()
			mockVariablesParser.parseEntityOptions.mockClear()

			// The options parse the same, so a re-parse is not resent to the module
			variableDependencies.dispatch(new Set(['var1']), null)
			vi.runAllTimers()
			expect(mockVariablesParser.parseEntityOptions).not.toHaveBeenCalled()

			variableDependencies.dispatch(new Set(['other-var']), null)
			vi.runAllTimers()
			expect(mockVariablesParser.parseEntityOptions).toHaveBeenCalledTimes(1)
		})

		it('ignores changes while an entity is not ready', () => {
			feedbackManager.start(5)
			feedbackManager.trackEntity(makeFeedback('entity-1') as any, CreateBankControlId('control-1'))
			vi.runAllTimers()
			mockAdapter.updateFeedbacks.mockClear()
			const subscriptionId = feedbackManager.getSubscriptionId('entity-1')!

			// Pending deletion, so the change must not resurrect it
			feedbackManager.forgetEntity('entity-1')
			variableDependencies.dispatch(new Set(['var1']), null)
			vi.runAllTimers()

			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledTimes(1)
			expect(mockAdapter.updateFeedbacks.mock.calls[0][0]).toEqual(new Map([[subscriptionId, null]]))
		})
	})

	describe('onRenderClockTick (render clock)', () => {
		const makeFeedback = (id = 'feedback-1') => ({
			id,
			type: EntityModelType.Feedback,
			definitionId: 'feedback-def-1',
			upgradeIndex: 5,
			asEntityModel: vi.fn().mockReturnValue({
				id,
				type: EntityModelType.Feedback,
				definitionId: 'feedback-def-1',
				connectionId: 'connection-1',
				options: {},
				upgradeIndex: 5,
			}),
			getEntityDefinition: vi.fn().mockReturnValue({
				hasLifecycleFunctions: true,
				options: [],
				optionsToIgnoreForSubscribe: [],
			}),
		})

		// The constructor subscribes exactly one callback to the render clock; capture it to fire ticks
		const getTick = (): (() => void) => mockRenderClock.subscribe.mock.calls[0][0]

		const mockClockSensitive = (clockSensitive: boolean) => {
			mockVariablesParser.parseEntityOptions.mockImplementation(() => ({
				ok: true,
				parsedOptions: {},
				referencedVariableIds: new Set<string>(),
				clockSensitive,
			}))
		}

		it('re-evaluates a clock-sensitive feedback on a clock tick', () => {
			mockClockSensitive(true)
			feedbackManager.start(5)
			feedbackManager.trackEntity(makeFeedback() as any, CreateBankControlId('control-1'))
			vi.runAllTimers()

			getTick()()
			vi.runAllTimers()

			expect(mockVariablesParser.parseEntityOptions).toHaveBeenCalledTimes(2)
		})

		it('does not re-evaluate a non-clock-sensitive feedback on a clock tick', () => {
			mockClockSensitive(false)
			feedbackManager.start(5)
			feedbackManager.trackEntity(makeFeedback() as any, CreateBankControlId('control-1'))
			vi.runAllTimers()
			mockAdapter.updateFeedbacks.mockClear()

			getTick()()
			vi.runAllTimers()

			expect(mockAdapter.updateFeedbacks).not.toHaveBeenCalled()
		})
	})

	describe('Performance', () => {
		it('should handle multiple concurrent entity operations efficiently', () => {
			feedbackManager.start(5)

			// Create a large number of entities
			const entityCount = 25
			const mockEntities: any[] = []

			for (let i = 0; i < entityCount; i++) {
				const mockEntity = {
					id: `entity-${i}`,
					type: EntityModelType.Feedback,
					definitionId: `def-${i}`,
					upgradeIndex: 5,
					asEntityModel: vi.fn().mockReturnValue({
						id: `entity-${i}`,
						type: EntityModelType.Feedback,
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
				feedbackManager.trackEntity(entity, CreateBankControlId(`control-${i}`))
			})

			// Run debounced function
			vi.runAllTimers()

			const payload: Map<string, EntityManagerEntity<FeedbackEntityModel> | null> =
				mockAdapter.updateFeedbacks.mock.calls[0][0]

			// Should have every entity
			expect(payload.size).toBe(entityCount)

			// Check a specific entity
			expect(payload.get(feedbackManager.getSubscriptionId('entity-1')!)).toEqual({
				controlId: CreateBankControlId('control-1'),
				entity: {
					id: 'entity-1',
					type: EntityModelType.Feedback,
					definitionId: 'def-1',
					connectionId: 'connection-1',
					options: { index: { isExpression: false, value: 1 } },
					upgradeIndex: 5,
				},
				parsedOptions: { index: 'value-0' },
			} satisfies EntityManagerEntity<FeedbackEntityModel>)
		})
	})

	describe('Edge Cases', () => {
		it('should skip feedback entities without lifecycle functions', () => {
			const mockFeedback = {
				id: 'feedback-1',
				type: EntityModelType.Feedback,
				definitionId: 'feedback-def-1',
				upgradeIndex: 5,
				asEntityModel: vi.fn().mockReturnValue({
					id: 'feedback-1',
					type: EntityModelType.Feedback,
					definitionId: 'feedback-def-1',
					connectionId: 'connection-1',
					options: {},
				}),
				getEntityDefinition: vi.fn().mockReturnValue({
					hasLifecycleFunctions: false,
					options: [],
					optionsToIgnoreForSubscribe: [],
				}),
			}

			feedbackManager.start(5)
			feedbackManager.trackEntity(mockFeedback as any, CreateBankControlId('control-1'))

			// Should skip the feedback entity since it doesn't have lifecycle functions
			vi.runAllTimers()

			expect(mockAdapter.updateFeedbacks).not.toHaveBeenCalled()
		})
	})

	describe('State Transitions', () => {
		it('should transition entity correctly between various states', () => {
			// Setup a mock entity that will need to be upgraded
			const mockEntity = {
				id: 'entity-1',
				type: EntityModelType.Action,
				definitionId: 'action-1',
				upgradeIndex: 3, // Lower than current index
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

			// The action is managed alongside, as a connection has both
			const actionManager = createActionManager(variableDependencies)
			actionManager.start(5)
			feedbackManager.start(5)
			actionManager.trackEntity(mockEntity as any, CreateBankControlId('control-1'))

			// Run initial process to send upgrade request
			vi.runAllTimers()

			// Entity is now in UPGRADING state

			// Call resendFeedbacks while entity is upgrading
			// This should mark feedbacks as UPGRADING_INVALIDATED
			mockAdapter.updateActions.mockClear()

			// Add a feedback that's in READY state
			const mockFeedback = {
				id: 'feedback-1',
				type: EntityModelType.Feedback,
				definitionId: 'feedback-def-1',
				upgradeIndex: 5,
				asEntityModel: vi.fn().mockReturnValue({
					id: 'feedback-1',
					type: EntityModelType.Feedback,
					definitionId: 'feedback-def-1',
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
			feedbackManager.trackEntity(mockFeedback as any, CreateBankControlId('control-2'))
			vi.runAllTimers()

			mockAdapter.updateActions.mockClear()

			// Now resend feedbacks
			feedbackManager.resendFeedbacks()
			vi.runAllTimers()

			// Should have called updateFeedbacks
			expect(mockAdapter.updateActions).not.toHaveBeenCalled()
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledWith(
				new Map<string, EntityManagerEntity<FeedbackEntityModel> | null>([
					subscriptionEntry({
						controlId: CreateBankControlId('control-2'),
						entity: {
							id: 'feedback-1',
							type: EntityModelType.Feedback,
							definitionId: 'feedback-def-1',
							connectionId: 'connection-1',
							options: {},
							upgradeIndex: 5,
						} as any,
						parsedOptions: {},
					} satisfies EntityManagerEntity<FeedbackEntityModel>),
				])
			)
		})
	})

	describe('Upgrade states', () => {
		it('should handle entities with varying upgrade states', async () => {
			feedbackManager.start(5)

			const entities = [
				{
					id: 'entity-1',
					type: EntityModelType.Feedback,
					definitionId: 'feedback-1',
					upgradeIndex: 3, // Needs upgrade
					asEntityModel: vi.fn().mockReturnValue({
						id: 'entity-1',
						type: EntityModelType.Feedback,
						definitionId: 'feedback-1',
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
					type: EntityModelType.Feedback,
					definitionId: 'feedback-2',
					upgradeIndex: 5, // Current version
					asEntityModel: vi.fn().mockReturnValue({
						id: 'entity-2',
						type: EntityModelType.Feedback,
						definitionId: 'feedback-2',
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
			mockAdapter.upgradeFeedbacks.mockImplementationOnce(async () => {
				return [
					{
						id: 'entity-1',
						type: EntityModelType.Feedback,
						definitionId: 'feedback-1',
						options: { upgraded: { isExpression: false, value: true } },
						upgradeIndex: 5,
					},
				] satisfies ReplaceableFeedbackEntityModel[]
			})

			// Track all entities
			entities.forEach((entity) => {
				feedbackManager.trackEntity(entity as any, CreateBankControlId('control-1'))
			})

			vi.runAllTimers()
			await vi.runAllTimersAsync()

			// Should have sent the entity that needs upgrading for upgrade
			expect(mockAdapter.upgradeFeedbacks).toHaveBeenCalledWith(
				[
					{
						controlId: CreateBankControlId('control-1'),
						entity: {
							id: 'entity-1',
							type: EntityModelType.Feedback,
							connectionId: 'connection-1',
							definitionId: 'feedback-1',
							options: {},
							upgradeIndex: 3,
						},
					},
				] satisfies EntityManagerUpgradeEntity<FeedbackEntityModel>[],
				5
			)

			// Should have sent the entity that doesn't need upgrading as an update
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledWith(
				new Map<string, EntityManagerEntity<FeedbackEntityModel> | null>([
					[feedbackManager.getSubscriptionId(entities[1].id)!, expect.anything()],
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

			feedbackManager.start(5)
		})

		it('should share one subscription between identical feedbacks in a control', () => {
			const fb1 = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' })
			const fb2 = createMockEntity('fb-2', EntityModelType.Feedback, { field1: 'a' })

			feedbackManager.trackEntity(fb1 as any, CreateBankControlId('control-1'))
			feedbackManager.trackEntity(fb2 as any, CreateBankControlId('control-1'))
			vi.runAllTimers()

			const subscriptionId = feedbackManager.getSubscriptionId('fb-1')!
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledTimes(1)
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledWith(
				new Map([
					[
						subscriptionId,
						expect.objectContaining({ controlId: CreateBankControlId('control-1'), parsedOptions: { field1: 'a' } }),
					],
				])
			)
			expect(feedbackManager.getSubscriptionId('fb-1')).toBe(subscriptionId)
			expect(feedbackManager.getSubscriptionId('fb-2')).toBe(subscriptionId)
		})

		it('should not share subscriptions across controls', () => {
			const fb1 = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' })
			const fb2 = createMockEntity('fb-2', EntityModelType.Feedback, { field1: 'a' })

			feedbackManager.trackEntity(fb1 as any, CreateBankControlId('control-1'))
			feedbackManager.trackEntity(fb2 as any, CreateBankControlId('control-2'))
			vi.runAllTimers()

			const payload: Map<string, EntityManagerEntity<FeedbackEntityModel> | null> =
				mockAdapter.updateFeedbacks.mock.calls[0][0]
			expect([...payload.keys()]).toEqual([
				feedbackManager.getSubscriptionId('fb-1'),
				feedbackManager.getSubscriptionId('fb-2'),
			])
			expect(feedbackManager.getSubscriptionId('fb-1')).not.toBe(feedbackManager.getSubscriptionId('fb-2'))
		})

		it('should not share subscriptions between entities with different options or definitions', () => {
			const fb1 = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' })
			const fb2 = createMockEntity('fb-2', EntityModelType.Feedback, { field1: 'b' })
			const fb3 = createMockEntity('fb-3', EntityModelType.Feedback, { field1: 'a' }, { definitionId: 'def-2' })

			for (const fb of [fb1, fb2, fb3]) feedbackManager.trackEntity(fb as any, CreateBankControlId('control-1'))
			vi.runAllTimers()

			const payload: Map<string, EntityManagerEntity<FeedbackEntityModel> | null> =
				mockAdapter.updateFeedbacks.mock.calls[0][0]
			expect(payload.size).toBe(3)
		})

		it('should share a subscription between feedbacks which differ only in inversion', () => {
			const fb1 = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' })
			const fb2 = createMockEntity(
				'fb-2',
				EntityModelType.Feedback,
				{ field1: 'a' },
				{ isInverted: { isExpression: false, value: true } }
			)

			feedbackManager.trackEntity(fb1 as any, CreateBankControlId('control-1'))
			feedbackManager.trackEntity(fb2 as any, CreateBankControlId('control-1'))
			vi.runAllTimers()

			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledTimes(1)
			expect(feedbackManager.getSubscriptionId('fb-2')).toBe(feedbackManager.getSubscriptionId('fb-1'))
		})

		it('should not share subscriptions between an action and a feedback', () => {
			const actionManager = createActionManager(variableDependencies)
			actionManager.start(5)
			const action = createMockEntity('action-1', EntityModelType.Action, { field1: 'a' })
			const fb = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' })

			actionManager.trackEntity(action as any, CreateBankControlId('control-1'))
			feedbackManager.trackEntity(fb as any, CreateBankControlId('control-1'))
			vi.runAllTimers()

			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map([[actionManager.getSubscriptionId('action-1'), expect.anything()]])
			)
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledWith(
				new Map([[feedbackManager.getSubscriptionId('fb-1'), expect.anything()]])
			)
			expect(actionManager.getSubscriptionId('action-1')).not.toBe(feedbackManager.getSubscriptionId('fb-1'))
		})

		it('should find an entity of a subscription by its id, only in its own control', () => {
			const fb1 = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' })
			const fb2 = createMockEntity('fb-2', EntityModelType.Feedback, { field1: 'a' })

			feedbackManager.trackEntity(fb1 as any, CreateBankControlId('control-1'))
			feedbackManager.trackEntity(fb2 as any, CreateBankControlId('control-1'))
			vi.runAllTimers()

			const subscriptionId = feedbackManager.getSubscriptionId('fb-1')!
			expect([fb1, fb2]).toContain(
				feedbackManager.getSubscriptionEntity(subscriptionId, CreateBankControlId('control-1'))
			)
			expect(feedbackManager.getSubscriptionEntity(subscriptionId, CreateBankControlId('control-2'))).toBeUndefined()
			expect(feedbackManager.getSubscriptionEntity('unknown', CreateBankControlId('control-1'))).toBeUndefined()

			// Once the last member leaves, there is nothing to find
			feedbackManager.forgetEntity('fb-1')
			feedbackManager.forgetEntity('fb-2')
			vi.runAllTimers()
			expect(feedbackManager.getSubscriptionEntity(subscriptionId, CreateBankControlId('control-1'))).toBeUndefined()
		})

		it('should pass a value to every member of the subscription', () => {
			const fb1 = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' })
			const fb2 = createMockEntity('fb-2', EntityModelType.Feedback, { field1: 'a' })
			const fb3 = createMockEntity('fb-3', EntityModelType.Feedback, { field1: 'b' })

			for (const fb of [fb1, fb2, fb3]) feedbackManager.trackEntity(fb as any, CreateBankControlId('control-1'))
			vi.runAllTimers()

			feedbackManager.handleFeedbackValues([
				{ id: feedbackManager.getSubscriptionId('fb-1')!, controlId: CreateBankControlId('control-1'), value: true },
			])

			expect(mockControlsController.updateFeedbackValues).toHaveBeenCalledTimes(1)
			expect(mockControlsController.updateFeedbackValues).toHaveBeenCalledWith('test-connection-id', [
				{ entityId: 'fb-1', controlId: CreateBankControlId('control-1'), value: true },
				{ entityId: 'fb-2', controlId: CreateBankControlId('control-1'), value: true },
			])
		})

		it('should ignore values for unknown subscriptions or the wrong control', () => {
			const fb1 = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' })

			feedbackManager.trackEntity(fb1 as any, CreateBankControlId('control-1'))
			vi.runAllTimers()

			feedbackManager.handleFeedbackValues([
				{ id: 'unknown', controlId: CreateBankControlId('control-1'), value: true },
				{ id: feedbackManager.getSubscriptionId('fb-1')!, controlId: CreateBankControlId('control-2'), value: true },
			])

			expect(mockControlsController.updateFeedbackValues).not.toHaveBeenCalled()
		})

		it('should not reuse the subscription of an entity moving to another control', () => {
			const fb1 = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' })

			feedbackManager.trackEntity(fb1 as any, CreateBankControlId('control-1'))
			vi.runAllTimers()
			const oldSubscriptionId = feedbackManager.getSubscriptionId('fb-1')!
			mockAdapter.updateFeedbacks.mockClear()

			feedbackManager.trackEntity(fb1 as any, CreateBankControlId('control-2'))
			vi.runAllTimers()

			// The subscription knows its control, so the old one is deleted and a new one made
			const newSubscriptionId = feedbackManager.getSubscriptionId('fb-1')!
			expect(newSubscriptionId).not.toBe(oldSubscriptionId)
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledWith(
				new Map([
					[newSubscriptionId, expect.objectContaining({ controlId: CreateBankControlId('control-2') })],
					[oldSubscriptionId, null],
				])
			)

			feedbackManager.handleFeedbackValues([
				{ id: newSubscriptionId, controlId: CreateBankControlId('control-2'), value: true },
			])
			expect(mockControlsController.updateFeedbackValues).toHaveBeenCalledWith('test-connection-id', [
				{ entityId: 'fb-1', controlId: CreateBankControlId('control-2'), value: true },
			])
		})

		it('should ignore a value reported for an action subscription, and not give it to an action joining later', () => {
			// The module reports every value to the feedback manager, which knows nothing of the actions' subscriptions
			const actionManager = createActionManager(variableDependencies)
			actionManager.start(5)
			const action1 = createMockEntity('action-1', EntityModelType.Action, { field1: 'a' })
			const action2 = createMockEntity('action-2', EntityModelType.Action, { field1: 'a' })

			actionManager.trackEntity(action1 as any, CreateBankControlId('control-1'))
			vi.runAllTimers()

			feedbackManager.handleFeedbackValues([
				{ id: actionManager.getSubscriptionId('action-1')!, controlId: CreateBankControlId('control-1'), value: true },
			])
			expect(mockControlsController.updateFeedbackValues).not.toHaveBeenCalled()

			actionManager.trackEntity(action2 as any, CreateBankControlId('control-1'))
			vi.runAllTimers()

			expect(actionManager.getSubscriptionId('action-2')).toBe(actionManager.getSubscriptionId('action-1'))
			expect(mockControlsController.updateFeedbackValues).not.toHaveBeenCalled()
		})

		it('should give an entity joining a subscription its current value, without telling the module', () => {
			const fb1 = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' })
			const fb2 = createMockEntity('fb-2', EntityModelType.Feedback, { field1: 'a' })

			feedbackManager.trackEntity(fb1 as any, CreateBankControlId('control-1'))
			vi.runAllTimers()
			feedbackManager.handleFeedbackValues([
				{ id: feedbackManager.getSubscriptionId('fb-1')!, controlId: CreateBankControlId('control-1'), value: 42 },
			])
			mockAdapter.updateFeedbacks.mockClear()
			mockControlsController.updateFeedbackValues.mockClear()

			feedbackManager.trackEntity(fb2 as any, CreateBankControlId('control-1'))
			vi.runAllTimers()

			expect(mockAdapter.updateFeedbacks).not.toHaveBeenCalled()
			expect(mockControlsController.updateFeedbackValues).toHaveBeenCalledWith('test-connection-id', [
				{ entityId: 'fb-2', controlId: CreateBankControlId('control-1'), value: 42 },
			])
		})

		it.each([
			['replaced', false],
			['forgotten then tracked again', true],
		])(
			'should give the current value to a new instance of an entity which stays in its subscription, when %s',
			(_name, forgetFirst) => {
				const fb1 = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' })
				const fb2 = createMockEntity('fb-2', EntityModelType.Feedback, { field1: 'a' })

				feedbackManager.trackEntity(fb1 as any, CreateBankControlId('control-1'))
				feedbackManager.trackEntity(fb2 as any, CreateBankControlId('control-1'))
				vi.runAllTimers()
				feedbackManager.handleFeedbackValues([
					{ id: feedbackManager.getSubscriptionId('fb-1')!, controlId: CreateBankControlId('control-1'), value: 42 },
				])
				mockAdapter.updateFeedbacks.mockClear()
				mockControlsController.updateFeedbackValues.mockClear()

				// A new instance with the same id and options, such as when the copy of a custom action is rebuilt
				if (forgetFirst) feedbackManager.forgetEntity('fb-1')
				feedbackManager.trackEntity(
					createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' }) as any,
					CreateBankControlId('control-1')
				)
				vi.runAllTimers()

				// The module already has the subscription, and won't report its value again until it changes
				expect(mockAdapter.updateFeedbacks).not.toHaveBeenCalled()
				expect(mockControlsController.updateFeedbackValues).toHaveBeenCalledWith('test-connection-id', [
					{ entityId: 'fb-1', controlId: CreateBankControlId('control-1'), value: 42 },
				])
			}
		)

		it('should not give the value again to an entity which is re-parsed unchanged', () => {
			const fb1 = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' })

			feedbackManager.trackEntity(fb1 as any, CreateBankControlId('control-1'))
			vi.runAllTimers()
			feedbackManager.handleFeedbackValues([
				{ id: feedbackManager.getSubscriptionId('fb-1')!, controlId: CreateBankControlId('control-1'), value: 42 },
			])
			mockControlsController.updateFeedbackValues.mockClear()

			// The same instance, re-tracked as when its options are set
			feedbackManager.trackEntity(fb1 as any, CreateBankControlId('control-1'))
			vi.runAllTimers()

			expect(mockControlsController.updateFeedbackValues).not.toHaveBeenCalled()
		})

		it('should not give a value to an entity joining a subscription which has no value yet', () => {
			const fb1 = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' })
			const fb2 = createMockEntity('fb-2', EntityModelType.Feedback, { field1: 'a' })

			feedbackManager.trackEntity(fb1 as any, CreateBankControlId('control-1'))
			vi.runAllTimers()
			feedbackManager.trackEntity(fb2 as any, CreateBankControlId('control-1'))
			vi.runAllTimers()

			expect(mockControlsController.updateFeedbackValues).not.toHaveBeenCalled()
		})

		it('should delete the subscription only when the last member leaves', () => {
			const fb1 = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' })
			const fb2 = createMockEntity('fb-2', EntityModelType.Feedback, { field1: 'a' })

			feedbackManager.trackEntity(fb1 as any, CreateBankControlId('control-1'))
			feedbackManager.trackEntity(fb2 as any, CreateBankControlId('control-1'))
			vi.runAllTimers()
			mockAdapter.updateFeedbacks.mockClear()
			const subscriptionId = feedbackManager.getSubscriptionId('fb-1')!

			// The first member leaving keeps the subscription for the other
			feedbackManager.forgetEntity('fb-1')
			vi.runAllTimers()
			expect(mockAdapter.updateFeedbacks).not.toHaveBeenCalled()

			// Values now only go to the remaining member
			feedbackManager.handleFeedbackValues([
				{ id: subscriptionId, controlId: CreateBankControlId('control-1'), value: true },
			])
			expect(mockControlsController.updateFeedbackValues).toHaveBeenCalledWith('test-connection-id', [
				{ entityId: 'fb-2', controlId: CreateBankControlId('control-1'), value: true },
			])

			// The last member leaving deletes it
			feedbackManager.forgetEntity('fb-2')
			vi.runAllTimers()
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledWith(new Map([[subscriptionId, null]]))
		})

		it('should not reuse the value of a deleted subscription when it is created again', () => {
			const fb1 = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' })

			feedbackManager.trackEntity(fb1 as any, CreateBankControlId('control-1'))
			vi.runAllTimers()
			const subscriptionId = feedbackManager.getSubscriptionId('fb-1')!
			feedbackManager.handleFeedbackValues([
				{ id: subscriptionId, controlId: CreateBankControlId('control-1'), value: true },
			])
			feedbackManager.forgetEntity('fb-1')
			vi.runAllTimers()
			mockAdapter.updateFeedbacks.mockClear()
			mockControlsController.updateFeedbackValues.mockClear()

			feedbackManager.trackEntity(fb1 as any, CreateBankControlId('control-1'))
			vi.runAllTimers()

			const newSubscriptionId = feedbackManager.getSubscriptionId('fb-1')!
			expect(newSubscriptionId).not.toBe(subscriptionId)
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledWith(new Map([[newSubscriptionId, expect.anything()]]))
			expect(mockControlsController.updateFeedbackValues).not.toHaveBeenCalled()
		})

		it('should move an entity to a new subscription when its options change', () => {
			const fb1 = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' })
			const fb2 = createMockEntity('fb-2', EntityModelType.Feedback, { field1: 'a' })

			feedbackManager.trackEntity(fb1 as any, CreateBankControlId('control-1'))
			feedbackManager.trackEntity(fb2 as any, CreateBankControlId('control-1'))
			vi.runAllTimers()
			mockAdapter.updateFeedbacks.mockClear()
			const oldSubscriptionId = feedbackManager.getSubscriptionId('fb-1')!

			// fb-2 now parses to something else
			const fb2Changed = createMockEntity('fb-2', EntityModelType.Feedback, { field1: 'b' })
			feedbackManager.trackEntity(fb2Changed as any, CreateBankControlId('control-1'))
			vi.runAllTimers()

			// A new subscription is made, and the old one is kept for fb-1
			const newSubscriptionId = feedbackManager.getSubscriptionId('fb-2')!
			expect(newSubscriptionId).not.toBe(oldSubscriptionId)
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledWith(
				new Map([[newSubscriptionId, expect.objectContaining({ parsedOptions: { field1: 'b' } })]])
			)
			expect(feedbackManager.getSubscriptionId('fb-1')).toBe(oldSubscriptionId)

			// Values are routed by the new membership
			feedbackManager.handleFeedbackValues([
				{ id: oldSubscriptionId, controlId: CreateBankControlId('control-1'), value: 'old' },
				{ id: newSubscriptionId, controlId: CreateBankControlId('control-1'), value: 'new' },
			])
			expect(mockControlsController.updateFeedbackValues).toHaveBeenCalledWith('test-connection-id', [
				{ entityId: 'fb-1', controlId: CreateBankControlId('control-1'), value: 'old' },
				{ entityId: 'fb-2', controlId: CreateBankControlId('control-1'), value: 'new' },
			])
			mockAdapter.updateFeedbacks.mockClear()
			mockControlsController.updateFeedbackValues.mockClear()

			// fb-1 changes to match fb-2, so the old subscription is deleted and fb-1 gets the current value
			const fb1Changed = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'b' })
			feedbackManager.trackEntity(fb1Changed as any, CreateBankControlId('control-1'))
			vi.runAllTimers()

			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledWith(new Map([[oldSubscriptionId, null]]))
			expect(mockControlsController.updateFeedbackValues).toHaveBeenCalledWith('test-connection-id', [
				{ entityId: 'fb-1', controlId: CreateBankControlId('control-1'), value: 'new' },
			])
			expect(feedbackManager.getSubscriptionId('fb-1')).toBe(newSubscriptionId)
		})

		it('should update a shared subscription in place when all of its members change together', () => {
			const fb1 = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' })
			const fb2 = createMockEntity('fb-2', EntityModelType.Feedback, { field1: 'a' })

			feedbackManager.trackEntity(fb1 as any, CreateBankControlId('control-1'))
			feedbackManager.trackEntity(fb2 as any, CreateBankControlId('control-1'))
			vi.runAllTimers()
			mockAdapter.updateFeedbacks.mockClear()
			const subscriptionId = feedbackManager.getSubscriptionId('fb-1')!

			feedbackManager.trackEntity(
				createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'b' }) as any,
				CreateBankControlId('control-1')
			)
			feedbackManager.trackEntity(
				createMockEntity('fb-2', EntityModelType.Feedback, { field1: 'b' }) as any,
				CreateBankControlId('control-1')
			)
			vi.runAllTimers()

			expect(feedbackManager.getSubscriptionId('fb-1')).toBe(subscriptionId)
			expect(feedbackManager.getSubscriptionId('fb-2')).toBe(subscriptionId)
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledTimes(1)
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledWith(
				new Map([[subscriptionId, expect.objectContaining({ parsedOptions: { field1: 'b' } })]])
			)
		})

		it('should update the subscription of the last member in place after the others have moved', () => {
			const fb1 = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' })
			const fb2 = createMockEntity('fb-2', EntityModelType.Feedback, { field1: 'a' })

			feedbackManager.trackEntity(fb1 as any, CreateBankControlId('control-1'))
			feedbackManager.trackEntity(fb2 as any, CreateBankControlId('control-1'))
			vi.runAllTimers()
			const subscriptionId = feedbackManager.getSubscriptionId('fb-1')!

			// fb-2 splits off first
			feedbackManager.trackEntity(
				createMockEntity('fb-2', EntityModelType.Feedback, { field1: 'b' }) as any,
				CreateBankControlId('control-1')
			)
			vi.runAllTimers()
			mockAdapter.updateFeedbacks.mockClear()

			// fb-1 is now the only member, so its subscription follows it
			feedbackManager.trackEntity(
				createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'c' }) as any,
				CreateBankControlId('control-1')
			)
			vi.runAllTimers()

			expect(feedbackManager.getSubscriptionId('fb-1')).toBe(subscriptionId)
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledWith(
				new Map([[subscriptionId, expect.objectContaining({ parsedOptions: { field1: 'c' } })]])
			)
		})

		it('should swap subscriptions without telling the module when members swap options', () => {
			const fb1 = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' })
			const fb2 = createMockEntity('fb-2', EntityModelType.Feedback, { field1: 'b' })

			feedbackManager.trackEntity(fb1 as any, CreateBankControlId('control-1'))
			feedbackManager.trackEntity(fb2 as any, CreateBankControlId('control-1'))
			vi.runAllTimers()
			const subscriptionIdA = feedbackManager.getSubscriptionId('fb-1')!
			const subscriptionIdB = feedbackManager.getSubscriptionId('fb-2')!
			feedbackManager.handleFeedbackValues([
				{ id: subscriptionIdA, controlId: CreateBankControlId('control-1'), value: 'a' },
				{ id: subscriptionIdB, controlId: CreateBankControlId('control-1'), value: 'b' },
			])
			mockAdapter.updateFeedbacks.mockClear()
			mockControlsController.updateFeedbackValues.mockClear()

			feedbackManager.trackEntity(
				createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'b' }) as any,
				CreateBankControlId('control-1')
			)
			feedbackManager.trackEntity(
				createMockEntity('fb-2', EntityModelType.Feedback, { field1: 'a' }) as any,
				CreateBankControlId('control-1')
			)
			vi.runAllTimers()

			expect(mockAdapter.updateFeedbacks).not.toHaveBeenCalled()
			expect(feedbackManager.getSubscriptionId('fb-1')).toBe(subscriptionIdB)
			expect(feedbackManager.getSubscriptionId('fb-2')).toBe(subscriptionIdA)
			expect(mockControlsController.updateFeedbackValues).toHaveBeenCalledWith('test-connection-id', [
				{ entityId: 'fb-1', controlId: CreateBankControlId('control-1'), value: 'b' },
				{ entityId: 'fb-2', controlId: CreateBankControlId('control-1'), value: 'a' },
			])
		})

		it('should not give the value from before an in place update to an entity joining it', () => {
			const fb1 = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' })

			feedbackManager.trackEntity(fb1 as any, CreateBankControlId('control-1'))
			vi.runAllTimers()
			feedbackManager.handleFeedbackValues([
				{ id: feedbackManager.getSubscriptionId('fb-1')!, controlId: CreateBankControlId('control-1'), value: 'old' },
			])
			feedbackManager.trackEntity(
				createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'b' }) as any,
				CreateBankControlId('control-1')
			)
			vi.runAllTimers()
			mockControlsController.updateFeedbackValues.mockClear()

			// fb-2 joins before the module has reported a value for the new options
			feedbackManager.trackEntity(
				createMockEntity('fb-2', EntityModelType.Feedback, { field1: 'b' }) as any,
				CreateBankControlId('control-1')
			)
			vi.runAllTimers()

			expect(feedbackManager.getSubscriptionId('fb-2')).toBe(feedbackManager.getSubscriptionId('fb-1'))
			expect(mockControlsController.updateFeedbackValues).not.toHaveBeenCalled()
		})

		it('should not resend the subscription when members are re-parsed to the same options', () => {
			const fb1 = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' })
			const fb2 = createMockEntity('fb-2', EntityModelType.Feedback, { field1: 'a' })

			feedbackManager.trackEntity(fb1 as any, CreateBankControlId('control-1'))
			feedbackManager.trackEntity(fb2 as any, CreateBankControlId('control-1'))
			vi.runAllTimers()
			mockAdapter.updateFeedbacks.mockClear()

			variableDependencies.dispatch(new Set(['var1']), null)
			vi.runAllTimers()

			// Both members re-parse to the same subscription, which the module already has
			expect(mockVariablesParser.parseEntityOptions).toHaveBeenCalledTimes(4)
			expect(mockAdapter.updateFeedbacks).not.toHaveBeenCalled()

			// Unless something not covered by the options has changed
			feedbackManager.resendFeedbacks()
			vi.runAllTimers()
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledTimes(1)
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledWith(
				new Map([[feedbackManager.getSubscriptionId('fb-1'), expect.anything()]])
			)
		})

		it('should leave the subscription when an entity becomes disabled', () => {
			const fb1 = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' })

			feedbackManager.trackEntity(fb1 as any, CreateBankControlId('control-1'))
			vi.runAllTimers()
			mockAdapter.updateFeedbacks.mockClear()
			const subscriptionId = feedbackManager.getSubscriptionId('fb-1')!

			const fb1Disabled = { ...createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' }), disabled: true }
			feedbackManager.trackEntity(fb1Disabled as any, CreateBankControlId('control-1'))
			vi.runAllTimers()

			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledWith(new Map([[subscriptionId, null]]))
			expect(feedbackManager.getSubscriptionId('fb-1')).toBeUndefined()
		})

		it('should forget all subscriptions when destroyed', () => {
			const fb1 = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' })

			feedbackManager.trackEntity(fb1 as any, CreateBankControlId('control-1'))
			vi.runAllTimers()
			const subscriptionId = feedbackManager.getSubscriptionId('fb-1')!
			feedbackManager.destroy()

			feedbackManager.handleFeedbackValues([
				{ id: subscriptionId, controlId: CreateBankControlId('control-1'), value: true },
			])
			expect(mockControlsController.updateFeedbackValues).not.toHaveBeenCalled()
		})
	})
})
