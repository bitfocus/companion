import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
	EntityModelType,
	type ReplaceableActionEntityModel,
	type ReplaceableFeedbackEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import type { CompanionOptionValues } from '@companion-module/host'
import {
	ConnectionEntityManager,
	type EntityManagerActionEntity,
	type EntityManagerAdapter,
	type EntityManagerFeedbackEntity,
} from '../../lib/Instance/Connection/EntityManager.js'

describe('InstanceEntityManager', () => {
	// Create mock objects for dependencies
	const mockAdapter = {
		updateActions: vi.fn().mockResolvedValue(null),
		updateFeedbacks: vi.fn().mockResolvedValue(null),

		upgradeActions: vi.fn().mockResolvedValue([]),
		upgradeFeedbacks: vi.fn().mockResolvedValue([]),
	} satisfies EntityManagerAdapter

	const mockControl = {
		entities: {
			entityReplaceForUpgrade: vi.fn(),
		},
		supportsEntities: true,
	}

	const mockVariablesParser = {
		parseEntityOptions: vi.fn().mockImplementation((entityDefinition, _options) => {
			const parsedOptions: CompanionOptionValues = {}

			let i = 0
			for (const option of entityDefinition.options) {
				parsedOptions[option.id] = `value-${i++}`
			}

			return {
				ok: true,
				parsedOptions: parsedOptions,
				referencedVariableIds: new Set(['var1', 'var2']),
			}
		}),
	}

	const mockControlsController = {
		getControl: vi.fn().mockReturnValue(mockControl),
		createVariablesAndExpressionParser: vi.fn().mockReturnValue(mockVariablesParser),
		updateFeedbackValues: vi.fn(),
	}

	const mockRenderClock = {
		subscribe: vi.fn().mockReturnValue(() => {}),
		destroy: vi.fn(),
	}

	let entityManager: ConnectionEntityManager

	/**
	 * An entry of an update payload, keyed by the id of the subscription the entity is in
	 */
	const subscriptionEntry = <T extends EntityManagerActionEntity | EntityManagerFeedbackEntity>(
		payload: T
	): [string, T] => [entityManager.getSubscriptionId(payload.entity.id)!, payload]

	// Reset mocks before each test
	beforeEach(() => {
		vi.clearAllMocks()

		// Reset mock implementations to defaults (clearAllMocks only clears call history)
		mockVariablesParser.parseEntityOptions.mockImplementation((entityDefinition, _options) => {
			const parsedOptions: CompanionOptionValues = {}

			let i = 0
			for (const option of entityDefinition.options) {
				parsedOptions[option.id] = `value-${i++}`
			}

			return {
				ok: true,
				parsedOptions: parsedOptions,
				referencedVariableIds: new Set(['var1', 'var2']),
			}
		})
		mockControlsController.getControl.mockReturnValue(mockControl)
		mockControlsController.createVariablesAndExpressionParser.mockReturnValue(mockVariablesParser)
		mockAdapter.updateActions.mockResolvedValue(null)
		mockAdapter.updateFeedbacks.mockResolvedValue(null)
		mockAdapter.upgradeActions.mockResolvedValue([])
		mockAdapter.upgradeFeedbacks.mockResolvedValue([])

		// Create a new instance for each test
		entityManager = new ConnectionEntityManager(
			mockAdapter,
			mockControlsController as any,
			'test-connection-id',
			mockRenderClock as any
		)

		// An entity parses its options in its own scope. The mock entities here use the scope of their control
		const trackEntity = entityManager.trackEntity.bind(entityManager)
		entityManager.trackEntity = (entity, controlId) => {
			;(entity as any).createVariablesAndExpressionParser ??= (overrides: any) =>
				mockControlsController.createVariablesAndExpressionParser(controlId, overrides)
			trackEntity(entity, controlId)
		}

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

			entityManager.start(5)
			entityManager.trackEntity(mockEntity as any, 'control-1')

			// Verify the entity is being processed
			vi.runAllTimers()

			expect(mockAdapter.updateFeedbacks).not.toHaveBeenCalled()
			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map<string, EntityManagerActionEntity | null>([
					subscriptionEntry({
						controlId: 'control-1',
						entity: {
							id: 'entity-1',
							type: EntityModelType.Action,
							definitionId: 'action-1',
							connectionId: 'connection-1',
							options: {},
						} as any,
						parsedOptions: {},
					} satisfies EntityManagerActionEntity),
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

			entityManager.start(5)
			entityManager.trackEntity(mockEntity1 as any, 'control-1')

			// Clear calls from first entity
			vi.runAllTimers()
			mockAdapter.updateActions.mockClear()
			const subscriptionId = entityManager.getSubscriptionId('entity-1')!

			// Track replacement entity
			entityManager.trackEntity(mockEntity2 as any, 'control-1')
			vi.runAllTimers()

			// Verify the replacement was processed, updating its subscription in place
			expect(mockEntity2.asEntityModel).toHaveBeenCalled()
			expect(entityManager.getSubscriptionId('entity-1')).toBe(subscriptionId)
			expect(mockAdapter.updateFeedbacks).not.toHaveBeenCalled()
			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map<string, EntityManagerActionEntity | null>([
					subscriptionEntry({
						controlId: 'control-1',
						entity: {
							id: 'entity-1',
							type: EntityModelType.Action,
							definitionId: 'action-1',
							connectionId: 'connection-1',
							options: { replaced: true },
						} as any,
						parsedOptions: { replaced: true },
					} satisfies EntityManagerActionEntity),
				])
			)
		})
	})

	describe('trackEntity for feedback', () => {
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

			entityManager.start(5)
			entityManager.trackEntity(mockFeedback as any, 'control-1')

			// Verify the entity is being processed
			vi.runAllTimers()

			expect(mockAdapter.updateActions).not.toHaveBeenCalled()
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledWith(
				new Map<string, EntityManagerFeedbackEntity | null>([
					subscriptionEntry({
						controlId: 'control-1',
						entity: {
							id: 'feedback-1',
							type: EntityModelType.Feedback,
							definitionId: 'feedback-def-1',
							connectionId: 'connection-1',
							options: {},
						} as any,
						parsedOptions: {},
					} satisfies EntityManagerFeedbackEntity),
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

			entityManager.start(5)
			entityManager.trackEntity(mockEntity as any, 'control-1')
			vi.runAllTimers()
			mockAdapter.updateActions.mockClear()
			const subscriptionId = entityManager.getSubscriptionId('entity-1')!

			entityManager.forgetEntity('entity-1')
			vi.runAllTimers()

			// Should have been called with null for the subscription of the entity
			expect(mockAdapter.updateFeedbacks).not.toHaveBeenCalled()
			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map<string, EntityManagerActionEntity | null>([[subscriptionId, null]])
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

			entityManager.start(5)
			entityManager.trackEntity(mockEntity as any, 'control-1')
			entityManager.forgetEntity('entity-1')
			vi.runAllTimers()

			expect(mockAdapter.updateActions).not.toHaveBeenCalled()
			expect(mockAdapter.updateFeedbacks).not.toHaveBeenCalled()
		})

		it('should do nothing if entity does not exist', () => {
			entityManager.start(5)
			entityManager.forgetEntity('non-existent')

			vi.runAllTimers()

			expect(mockAdapter.updateFeedbacks).not.toHaveBeenCalled()
			expect(mockAdapter.updateActions).not.toHaveBeenCalled()
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

			entityManager.start(5)
			entityManager.trackEntity(mockFeedback as any, 'control-1')

			// First clear the initial processing
			vi.runAllTimers()
			mockAdapter.updateFeedbacks.mockClear()

			// Now resend feedbacks
			entityManager.resendFeedbacks()
			vi.runAllTimers()

			expect(mockAdapter.updateActions).not.toHaveBeenCalled()
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledWith(
				new Map<string, EntityManagerFeedbackEntity | null>([
					subscriptionEntry({
						controlId: 'control-1',
						entity: {
							id: 'feedback-1',
							type: EntityModelType.Feedback,
							definitionId: 'feedback-def-1',
							connectionId: 'connection-1',
							options: {},
						} as any,
						parsedOptions: {},
					} satisfies EntityManagerFeedbackEntity),
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

			entityManager.start(5)

			// Add all feedbacks
			mockFeedbacks.forEach((fb, i) => {
				entityManager.trackEntity(fb as any, `control-${i + 1}`)
			})

			// Process initial state
			vi.runAllTimers()
			mockAdapter.updateFeedbacks.mockClear()
			const feedback2SubscriptionId = entityManager.getSubscriptionId('feedback-2')!

			// Force feedback-2 to be forgotten
			entityManager.forgetEntity('feedback-2')

			// Now resend feedbacks
			entityManager.resendFeedbacks()
			vi.runAllTimers()

			// Should have been called with the appropriate feedbacks
			expect(mockAdapter.updateActions).not.toHaveBeenCalled()
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledWith(
				new Map<string, EntityManagerFeedbackEntity | null>([
					subscriptionEntry({
						controlId: 'control-1',
						entity: {
							id: 'feedback-1',
							type: EntityModelType.Feedback,
							definitionId: 'feedback-def-1',
							connectionId: 'connection-1',
							options: {},
						} as any,
						parsedOptions: {},
					} satisfies EntityManagerFeedbackEntity),
					[feedback2SubscriptionId, null],
					subscriptionEntry({
						controlId: 'control-3',
						entity: {
							id: 'feedback-3',
							type: EntityModelType.Feedback,
							definitionId: 'feedback-def-1',
							connectionId: 'connection-1',
							options: {},
						} as any,
						parsedOptions: {},
					} satisfies EntityManagerFeedbackEntity),
				])
			)
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
			entityManager.start(5)
			entityManager.trackEntity(mockEntity as any, 'control-1')

			// Process the entity so it references variables
			vi.runAllTimers()
			mockAdapter.updateActions.mockClear()

			// Simulate variables changing, so that the entity parses to something else
			mockVariablesParser.parseEntityOptions.mockImplementation(() => ({
				ok: true,
				parsedOptions: { field1: 'new-value' },
				referencedVariableIds: new Set(['var1']),
			}))
			entityManager.onVariablesChanged(new Set(['var1']), null)
			vi.runAllTimers()

			// Verify it triggered a re-process, updating the subscription in place
			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map<string, EntityManagerActionEntity | null>([
					subscriptionEntry({
						controlId: 'control-1',
						entity: {
							id: 'entity-1',
							type: EntityModelType.Action,
							definitionId: 'action-1',
							connectionId: 'connection-1',
							options: { field1: '$(var:test)' },
						} as any,
						parsedOptions: { field1: 'new-value' },
					} satisfies EntityManagerActionEntity),
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

			entityManager.start(5)
			entityManager.trackEntity(mockEntity as any, 'control-1')
			vi.runAllTimers()
			mockAdapter.updateActions.mockClear()

			entityManager.onVariablesChanged(new Set(['var1']), null)
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
			entityManager.start(5)
			entityManager.trackEntity(mockEntity as any, 'control-1')

			// Process the entity so it references variables
			vi.runAllTimers()
			mockAdapter.updateActions.mockClear()

			// Simulate unrelated variables changing
			entityManager.onVariablesChanged(new Set(['unrelated-var']), null)
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
			entityManager.start(5)
			entityManager.trackEntity(mockEntity1 as any, 'control-1')
			entityManager.trackEntity(mockEntity2 as any, 'control-2')

			// Process the entities
			vi.runAllTimers()
			mockAdapter.updateActions.mockClear()

			// Simulate variables changing for only control-1, so that its entity parses to something else
			mockVariablesParser.parseEntityOptions.mockImplementation(() => ({
				ok: true,
				parsedOptions: { field1: 'changed' },
				referencedVariableIds: new Set(['var1', 'var2']),
			}))
			entityManager.onVariablesChanged(new Set(['var1']), new Set(['control-1']))
			vi.runAllTimers()

			// Should only have triggered a re-process for entity-1
			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map<string, EntityManagerActionEntity | null>([
					subscriptionEntry({
						controlId: 'control-1',
						entity: {
							id: 'entity-1',
							type: EntityModelType.Action,
							definitionId: 'action-1',
							connectionId: 'connection-1',
							options: { field1: '$(var:test)' },
						} as any,
						parsedOptions: { field1: 'changed' },
					} satisfies EntityManagerActionEntity),
				])
			)
			expect(mockAdapter.updateFeedbacks).not.toHaveBeenCalled()
		})

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
			entityManager.start(5)
			entityManager.trackEntity(mockEntity1 as any, 'control-1')
			entityManager.trackEntity(mockEntity2 as any, 'control-2')

			// Process the entities
			vi.runAllTimers()
			mockAdapter.updateFeedbacks.mockClear()

			// Simulate variables changing for only control-2, so that its entity parses to something else
			mockVariablesParser.parseEntityOptions.mockImplementation(() => ({
				ok: true,
				parsedOptions: { field1: 'changed' },
				referencedVariableIds: new Set(['control-var']),
			}))
			entityManager.onVariablesChanged(new Set(['control-var']), new Set(['control-2']))
			vi.runAllTimers()

			// Should only have triggered a re-process for entity-2, not entity-1
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledWith(
				new Map<string, EntityManagerFeedbackEntity | null>([
					subscriptionEntry({
						controlId: 'control-2',
						entity: {
							id: 'entity-2',
							type: EntityModelType.Feedback,
							definitionId: 'feedback-2',
							connectionId: 'connection-1',
							options: { field1: '$(var:test)' },
						} as any,
						parsedOptions: { field1: 'changed' },
					} satisfies EntityManagerFeedbackEntity),
				])
			)
			expect(mockAdapter.updateActions).not.toHaveBeenCalled()
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

		const makeAction = (id = 'action-1') => ({
			id,
			type: EntityModelType.Action,
			definitionId: 'action-def-1',
			upgradeIndex: 5,
			asEntityModel: vi.fn().mockReturnValue({
				id,
				type: EntityModelType.Action,
				definitionId: 'action-def-1',
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
		const getTick = (): (() => void) => mockRenderClock.subscribe.mock.calls[0][0] as () => void

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
			entityManager.start(5)
			entityManager.trackEntity(makeFeedback() as any, 'control-1')
			vi.runAllTimers()

			getTick()()
			vi.runAllTimers()

			expect(mockVariablesParser.parseEntityOptions).toHaveBeenCalledTimes(2)
		})

		it('does not re-evaluate a clock-sensitive action on a clock tick (actions are excluded)', () => {
			mockClockSensitive(true)
			entityManager.start(5)
			entityManager.trackEntity(makeAction() as any, 'control-1')
			vi.runAllTimers()
			mockAdapter.updateActions.mockClear()

			getTick()()
			vi.runAllTimers()

			expect(mockAdapter.updateActions).not.toHaveBeenCalled()
		})

		it('does not re-evaluate a non-clock-sensitive feedback on a clock tick', () => {
			mockClockSensitive(false)
			entityManager.start(5)
			entityManager.trackEntity(makeFeedback() as any, 'control-1')
			vi.runAllTimers()
			mockAdapter.updateFeedbacks.mockClear()

			getTick()()
			vi.runAllTimers()

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

			entityManager.start(5)
			entityManager.trackEntity(mockEntity as any, 'control-1')

			vi.runAllTimers()

			// Should have called upgradeActionsAndFeedbacks
			expect(mockAdapter.upgradeFeedbacks).not.toHaveBeenCalled()
			expect(mockAdapter.upgradeActions).toHaveBeenCalledWith(
				[
					{
						controlId: 'control-1',
						entity: {
							id: 'entity-1',
							type: EntityModelType.Action,
							definitionId: 'action-1',
							connectionId: 'connection-1',
							options: {},
							upgradeIndex: 3,
						},
					} satisfies Omit<EntityManagerActionEntity, 'parsedOptions'>,
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

			entityManager.start(5)
			entityManager.trackEntity(mockEntity as any, 'control-1')

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

			entityManager.start(5)
			entityManager.trackEntity(mockEntity as any, 'control-1')

			entityManager.destroy()

			// After destroy, tracking a new entity should not call processing
			mockAdapter.updateActions.mockClear()
			mockAdapter.updateFeedbacks.mockClear()
			entityManager.trackEntity(mockEntity as any, 'control-1')
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

			entityManager.start(5)
			entityManager.trackEntity(mockEntity as any, 'control-1')

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
			entityManager.trackEntity(mockEntity2 as any, 'control-1')
			vi.runAllTimers()

			// New entities should still be processed
			expect(mockAdapter.updateFeedbacks).not.toHaveBeenCalled()
			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map<string, EntityManagerActionEntity | null>([
					subscriptionEntry({
						controlId: 'control-1',
						entity: {
							id: 'entity-2',
							type: EntityModelType.Action,
							definitionId: 'action-2',
							connectionId: 'connection-1',
							options: {},
							upgradeIndex: 5,
						} as any,
						parsedOptions: {},
					} satisfies EntityManagerActionEntity),
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

			entityManager.start(5)
			entityManager.trackEntity(mockEntity as any, 'control-1')
			vi.runAllTimers()

			// It was never subscribed, so the module doesn't need to be told
			expect(mockAdapter.updateActions).not.toHaveBeenCalled()

			// Once it parses, it is subscribed
			entityManager.trackEntity(mockEntity as any, 'control-1')
			vi.runAllTimers()
			const subscriptionId = entityManager.getSubscriptionId('entity-1')!
			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map([[subscriptionId, expect.objectContaining({ parsedOptions: { field1: 'value-0' } })]])
			)
			mockAdapter.updateActions.mockClear()

			// When it fails to parse again, it is marked as inactive by removing its subscription
			mockVariablesParser.parseEntityOptions.mockImplementationOnce(failParse)
			entityManager.trackEntity(mockEntity as any, 'control-1')
			vi.runAllTimers()
			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map<string, EntityManagerActionEntity | null>([[subscriptionId, null]])
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

			entityManager.start(5)
			entityManager.trackEntity(mockEntity as any, 'control-1')
			vi.runAllTimers()

			// It was never subscribed, so the module doesn't need to be told
			expect(mockAdapter.updateActions).not.toHaveBeenCalled()

			// Once it parses, it is subscribed
			entityManager.trackEntity(mockEntity as any, 'control-1')
			vi.runAllTimers()
			const subscriptionId = entityManager.getSubscriptionId('entity-1')!
			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map([[subscriptionId, expect.objectContaining({ parsedOptions: { field1: 'value-0' } })]])
			)
			mockAdapter.updateActions.mockClear()

			// When it fails to parse again, it is marked as inactive by removing its subscription
			mockVariablesParser.parseEntityOptions.mockImplementationOnce(failParse)
			entityManager.trackEntity(mockEntity as any, 'control-1')
			vi.runAllTimers()
			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map<string, EntityManagerActionEntity | null>([[subscriptionId, null]])
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

			entityManager.start(5)
			entityManager.trackEntity(mockEntity as any, 'control-1')
			vi.runAllTimers()

			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map<string, EntityManagerActionEntity | null>([
					subscriptionEntry({
						controlId: 'control-1',
						entity: {
							id: 'entity-1',
							type: EntityModelType.Action,
							definitionId: 'action-1',
							connectionId: 'connection-1',
							options: { field1: { isExpression: true, value: '$(test:num) + 1' } },
							upgradeIndex: 5,
						},
						parsedOptions: { field1: 42 },
					} satisfies EntityManagerActionEntity),
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

			entityManager.start(5)
			entityManager.trackEntity(mockEntity as any, 'control-1')
			vi.runAllTimers()

			mockAdapter.updateActions.mockClear()

			// Trigger variable change for the referenced variable
			entityManager.onVariablesChanged(new Set(['test:expr_var']), null)
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

			entityManager.start(5)
			entityManager.trackEntity(mockEntity as any, 'control-1')
			vi.runAllTimers()

			mockAdapter.updateActions.mockClear()

			// Trigger variable change for an unrelated variable
			entityManager.onVariablesChanged(new Set(['other:unrelated_var']), null)
			vi.runAllTimers()

			// Should NOT have triggered a re-process
			expect(mockAdapter.updateActions).not.toHaveBeenCalled()
		})
	})

	describe('Performance', () => {
		it('should handle multiple concurrent entity operations efficiently', () => {
			entityManager.start(5)

			// Create a large number of entities
			const entityCount = 50
			const mockEntities: any[] = []

			for (let i = 0; i < entityCount; i++) {
				const isAction = i % 2 === 0

				const mockEntity = {
					id: `entity-${i}`,
					type: isAction ? EntityModelType.Action : EntityModelType.Feedback,
					definitionId: `def-${i}`,
					upgradeIndex: 5,
					asEntityModel: vi.fn().mockReturnValue({
						id: `entity-${i}`,
						type: isAction ? EntityModelType.Action : EntityModelType.Feedback,
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
				entityManager.trackEntity(entity, `control-${i}`)
			})

			// Run debounced function
			vi.runAllTimers()

			// Find action call and verify it contains expected action entities
			const actionPayload: Map<string, EntityManagerActionEntity | null> = mockAdapter.updateActions.mock.calls[0][0]

			// Should have exactly the right number of action entities (half of entityCount)
			expect(actionPayload.size).toBe(Math.ceil(entityCount / 2))

			// Check a few specific actions
			expect(actionPayload.get(entityManager.getSubscriptionId('entity-0')!)).toEqual({
				controlId: 'control-0',
				entity: {
					id: 'entity-0',
					type: EntityModelType.Action,
					definitionId: 'def-0',
					connectionId: 'connection-1',
					options: { index: { isExpression: false, value: 0 } },
					upgradeIndex: 5,
				},
				parsedOptions: { index: 'value-0' },
			} satisfies EntityManagerActionEntity)

			// Find feedback call and verify it contains expected feedback entities
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalled()
			const feedbackPayload: Map<string, EntityManagerFeedbackEntity | null> =
				mockAdapter.updateFeedbacks.mock.calls[0][0]

			// Should have exactly the right number of feedback entities (half of entityCount)
			expect(feedbackPayload.size).toBe(Math.floor(entityCount / 2))

			// Check a specific feedback
			expect(feedbackPayload.get(entityManager.getSubscriptionId('entity-1')!)).toEqual({
				controlId: 'control-1',
				entity: {
					id: 'entity-1',
					type: EntityModelType.Feedback,
					definitionId: 'def-1',
					connectionId: 'connection-1',
					options: { index: { isExpression: false, value: 1 } },
					upgradeIndex: 5,
				},
				parsedOptions: { index: 'value-0' },
			} satisfies EntityManagerFeedbackEntity)
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

			entityManager.start(5)

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
				entityManager.trackEntity(mockEntity as any, `control-${i}`)
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

			entityManager.start(5)
			entityManager.trackEntity(mockEntity as any, 'control-1')

			// Run initial process
			vi.runAllTimers()

			// Now forget the entity while the upgrade is in progress
			entityManager.forgetEntity('entity-1')

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

			entityManager.start(5)
			entityManager.trackEntity(mockEntity as any, 'control-1')
			vi.runAllTimers()

			// Should have passed the location to parse variables
			expect(mockControlsController.createVariablesAndExpressionParser).toHaveBeenCalledWith('control-1', null)
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

			entityManager.start(5)
			entityManager.trackEntity(mockEntity as any, 'control-1')

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

			entityManager.start(5)
			entityManager.trackEntity(mockEntity as any, 'control-1')

			// Should skip the entity since it doesn't have lifecycle functions
			vi.runAllTimers()

			expect(mockAdapter.updateActions).not.toHaveBeenCalled()
		})

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

			entityManager.start(5)
			entityManager.trackEntity(mockFeedback as any, 'control-1')

			// Should skip the feedback entity since it doesn't have lifecycle functions
			vi.runAllTimers()

			expect(mockAdapter.updateFeedbacks).not.toHaveBeenCalled()
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

			entityManager.start(5)
			entityManager.trackEntity(mockEntityWithLifecycle as any, 'control-1')
			entityManager.trackEntity(mockEntityWithoutLifecycle as any, 'control-2')

			vi.runAllTimers()

			// Only the entity with lifecycle functions should be sent to the module
			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map<string, EntityManagerActionEntity | null>([
					subscriptionEntry({
						controlId: 'control-1',
						entity: {
							id: 'entity-with-lifecycle',
							type: EntityModelType.Action,
							definitionId: 'action-1',
							connectionId: 'connection-1',
							options: {},
						} as any,
						parsedOptions: {},
					} satisfies EntityManagerActionEntity),
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

			entityManager.start(5)
			entityManager.trackEntity(mockEntity as any, 'control-1')

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

			entityManager.start(5)
			entityManager.trackEntity(mockEntity as any, 'control-1')

			vi.runAllTimers()

			// Upgrade should be sent
			expect(mockAdapter.upgradeActions).toHaveBeenCalledWith(
				[
					{
						controlId: 'control-1',
						entity: {
							id: 'entity-1',
							type: EntityModelType.Action,
							definitionId: 'action-1',
							connectionId: 'connection-1',
							options: {},
							upgradeIndex: 3,
							disabled: true,
						},
					} satisfies Omit<EntityManagerActionEntity, 'parsedOptions'>,
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

			entityManager.start(5)
			entityManager.trackEntity(mockEntityWithoutLifecycle as any, 'control-1')

			vi.runAllTimers()
			await vi.runAllTimersAsync()

			// Should call upgradeActionsAndFeedbacks first, but then ignore the result
			expect(mockAdapter.upgradeActions).toHaveBeenCalledWith(
				[
					{
						controlId: 'control-1',
						entity: {
							id: 'entity-without-lifecycle',
							type: EntityModelType.Action,
							definitionId: 'action-1',
							connectionId: 'connection-1',
							options: {},
							upgradeIndex: 3,
						},
					} satisfies Omit<EntityManagerActionEntity, 'parsedOptions'>,
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

			entityManager.start(5)
			entityManager.trackEntity(mockEntity as any, 'control-1')
			vi.runAllTimers()

			// Entity is subscribed
			const subscriptionId = entityManager.getSubscriptionId('entity-1')!
			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map<string, EntityManagerActionEntity | null>([
					[subscriptionId, expect.objectContaining({ controlId: 'control-1' })],
				])
			)

			mockAdapter.updateActions.mockClear()

			// Entity becomes disabled — forgetEntity is called
			entityManager.forgetEntity('entity-1')
			vi.runAllTimers()

			// Module should be told to unsubscribe (null)
			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map<string, EntityManagerActionEntity | null>([[subscriptionId, null]])
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

			entityManager.start(5)
			entityManager.trackEntity(mockEntity as any, 'control-1')
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

			entityManager.trackEntity(mockEntity as any, 'control-1')
			vi.runAllTimers()

			// Module should now receive the subscription
			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map<string, EntityManagerActionEntity | null>([
					subscriptionEntry({
						controlId: 'control-1',
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
					} satisfies EntityManagerActionEntity),
				])
			)
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

			entityManager.start(5)
			entityManager.trackEntity(mockEntity as any, 'control-1')

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
			entityManager.trackEntity(mockFeedback as any, 'control-2')
			vi.runAllTimers()

			mockAdapter.updateActions.mockClear()

			// Now resend feedbacks
			entityManager.resendFeedbacks()
			vi.runAllTimers()

			// Should have called updateFeedbacks
			expect(mockAdapter.updateActions).not.toHaveBeenCalled()
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledWith(
				new Map<string, EntityManagerFeedbackEntity | null>([
					subscriptionEntry({
						controlId: 'control-2',
						entity: {
							id: 'feedback-1',
							type: EntityModelType.Feedback,
							definitionId: 'feedback-def-1',
							connectionId: 'connection-1',
							options: {},
							upgradeIndex: 5,
						} as any,
						parsedOptions: {},
					} satisfies EntityManagerFeedbackEntity),
				])
			)
		})
	})

	describe('Multiple Entity Type Support', () => {
		it('should handle a mix of entity types with varying upgrade states', async () => {
			entityManager.start(5)

			// Create a mix of actions and feedbacks with different upgrade indexes
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
				{
					id: 'entity-3',
					type: EntityModelType.Feedback,
					definitionId: 'feedback-1',
					upgradeIndex: 3, // Needs upgrade
					asEntityModel: vi.fn().mockReturnValue({
						id: 'entity-3',
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
					id: 'entity-4',
					type: EntityModelType.Feedback,
					definitionId: 'feedback-2',
					upgradeIndex: 5, // Current version
					asEntityModel: vi.fn().mockReturnValue({
						id: 'entity-4',
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
			mockAdapter.upgradeFeedbacks.mockImplementationOnce(async () => {
				return [
					{
						id: 'entity-3',
						type: EntityModelType.Feedback,
						definitionId: 'feedback-1',
						options: { upgraded: { isExpression: false, value: true } },
						upgradeIndex: 5,
					},
				] satisfies ReplaceableFeedbackEntityModel[]
			})

			// Track all entities
			entities.forEach((entity) => {
				entityManager.trackEntity(entity as any, 'control-1')
			})

			vi.runAllTimers()
			await vi.runAllTimersAsync()

			// Should have sent entities that need upgrading to upgradeActionsAndFeedbacks
			expect(mockAdapter.upgradeActions).toHaveBeenCalledWith(
				[
					{
						controlId: 'control-1',
						entity: {
							id: 'entity-1',
							type: EntityModelType.Action,
							connectionId: 'connection-1',
							definitionId: 'action-1',
							options: {},
							upgradeIndex: 3,
						},
					},
				] satisfies Omit<EntityManagerActionEntity, 'parsedOptions'>[],
				5
			)
			expect(mockAdapter.upgradeFeedbacks).toHaveBeenCalledWith(
				[
					{
						controlId: 'control-1',
						entity: {
							id: 'entity-3',
							type: EntityModelType.Feedback,
							connectionId: 'connection-1',
							definitionId: 'feedback-1',
							options: {},
							upgradeIndex: 3,
						},
					},
				] satisfies Omit<EntityManagerFeedbackEntity, 'parsedOptions'>[],
				5
			)

			// Should have sent entities that don't need upgrading to updateActions/updateFeedbacks
			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map<string, EntityManagerActionEntity | null>([
					[entityManager.getSubscriptionId(entities[1].id)!, expect.anything()],
				])
			)
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledWith(
				new Map<string, EntityManagerFeedbackEntity | null>([
					[entityManager.getSubscriptionId(entities[3].id)!, expect.anything()],
				])
			)
		})
	})

	describe('Merged subscriptions', () => {
		const createMockEntity = (
			id: string,
			type: EntityModelType,
			options: Record<string, any>,
			extraModel: Record<string, any> = {}
		) => ({
			id,
			type,
			definitionId: 'def-1',
			upgradeIndex: 5,
			asEntityModel: vi.fn().mockReturnValue({
				id,
				type,
				definitionId: 'def-1',
				connectionId: 'connection-1',
				options,
				upgradeIndex: 5,
				...extraModel,
			}),
			getEntityDefinition: vi.fn().mockReturnValue({
				hasLifecycleFunctions: true,
				options: [{ id: 'field1', type: 'textinput' }],
				optionsToIgnoreForSubscribe: [],
			}),
		})

		beforeEach(() => {
			// The parsed options are the raw options, so that entities can be made to differ
			mockVariablesParser.parseEntityOptions.mockImplementation((_entityDefinition, options) => ({
				ok: true,
				parsedOptions: options,
				referencedVariableIds: new Set(['var1']),
			}))

			entityManager.start(5)
		})

		it('should share one subscription between identical feedbacks in a control', () => {
			const fb1 = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' })
			const fb2 = createMockEntity('fb-2', EntityModelType.Feedback, { field1: 'a' })

			entityManager.trackEntity(fb1 as any, 'control-1')
			entityManager.trackEntity(fb2 as any, 'control-1')
			vi.runAllTimers()

			const subscriptionId = entityManager.getSubscriptionId('fb-1')!
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledTimes(1)
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledWith(
				new Map([[subscriptionId, expect.objectContaining({ controlId: 'control-1', parsedOptions: { field1: 'a' } })]])
			)
			expect(entityManager.getSubscriptionId('fb-1')).toBe(subscriptionId)
			expect(entityManager.getSubscriptionId('fb-2')).toBe(subscriptionId)
		})

		it('should not share subscriptions across controls', () => {
			const fb1 = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' })
			const fb2 = createMockEntity('fb-2', EntityModelType.Feedback, { field1: 'a' })

			entityManager.trackEntity(fb1 as any, 'control-1')
			entityManager.trackEntity(fb2 as any, 'control-2')
			vi.runAllTimers()

			const payload: Map<string, EntityManagerFeedbackEntity | null> = mockAdapter.updateFeedbacks.mock.calls[0][0]
			expect([...payload.keys()]).toEqual([
				entityManager.getSubscriptionId('fb-1'),
				entityManager.getSubscriptionId('fb-2'),
			])
			expect(entityManager.getSubscriptionId('fb-1')).not.toBe(entityManager.getSubscriptionId('fb-2'))
		})

		it('should not share subscriptions between entities with different options or definitions', () => {
			const fb1 = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' })
			const fb2 = createMockEntity('fb-2', EntityModelType.Feedback, { field1: 'b' })
			const fb3 = createMockEntity('fb-3', EntityModelType.Feedback, { field1: 'a' }, { definitionId: 'def-2' })

			for (const fb of [fb1, fb2, fb3]) entityManager.trackEntity(fb as any, 'control-1')
			vi.runAllTimers()

			const payload: Map<string, EntityManagerFeedbackEntity | null> = mockAdapter.updateFeedbacks.mock.calls[0][0]
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

			entityManager.trackEntity(fb1 as any, 'control-1')
			entityManager.trackEntity(fb2 as any, 'control-1')
			vi.runAllTimers()

			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledTimes(1)
			expect(entityManager.getSubscriptionId('fb-2')).toBe(entityManager.getSubscriptionId('fb-1'))
		})

		it('should not share subscriptions between an action and a feedback', () => {
			const action = createMockEntity('action-1', EntityModelType.Action, { field1: 'a' })
			const fb = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' })

			entityManager.trackEntity(action as any, 'control-1')
			entityManager.trackEntity(fb as any, 'control-1')
			vi.runAllTimers()

			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map([[entityManager.getSubscriptionId('action-1'), expect.anything()]])
			)
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledWith(
				new Map([[entityManager.getSubscriptionId('fb-1'), expect.anything()]])
			)
			expect(entityManager.getSubscriptionId('action-1')).not.toBe(entityManager.getSubscriptionId('fb-1'))
		})

		it('should give the same id to identical actions, for executing them', () => {
			const action1 = createMockEntity('action-1', EntityModelType.Action, { field1: 'a' })
			const action2 = createMockEntity('action-2', EntityModelType.Action, { field1: 'a' })

			entityManager.trackEntity(action1 as any, 'control-1')
			entityManager.trackEntity(action2 as any, 'control-1')
			vi.runAllTimers()

			expect(mockAdapter.updateActions).toHaveBeenCalledTimes(1)
			expect(entityManager.getSubscriptionId('action-1')).toBeDefined()
			expect(entityManager.getSubscriptionId('action-2')).toBe(entityManager.getSubscriptionId('action-1'))
		})

		it('should have no subscription id for an entity which is not subscribed', () => {
			const action = createMockEntity('action-1', EntityModelType.Action, { field1: 'a' })
			action.getEntityDefinition.mockReturnValue({
				hasLifecycleFunctions: false,
				options: [],
				optionsToIgnoreForSubscribe: [],
			})

			entityManager.trackEntity(action as any, 'control-1')
			vi.runAllTimers()

			expect(entityManager.getSubscriptionId('action-1')).toBeUndefined()
			expect(entityManager.getSubscriptionId('unknown')).toBeUndefined()
		})

		it('should pass a value to every member of the subscription', () => {
			const fb1 = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' })
			const fb2 = createMockEntity('fb-2', EntityModelType.Feedback, { field1: 'a' })
			const fb3 = createMockEntity('fb-3', EntityModelType.Feedback, { field1: 'b' })

			for (const fb of [fb1, fb2, fb3]) entityManager.trackEntity(fb as any, 'control-1')
			vi.runAllTimers()

			entityManager.handleFeedbackValues([
				{ id: entityManager.getSubscriptionId('fb-1')!, controlId: 'control-1', value: true },
			])

			expect(mockControlsController.updateFeedbackValues).toHaveBeenCalledTimes(1)
			expect(mockControlsController.updateFeedbackValues).toHaveBeenCalledWith('test-connection-id', [
				{ entityId: 'fb-1', controlId: 'control-1', value: true },
				{ entityId: 'fb-2', controlId: 'control-1', value: true },
			])
		})

		it('should ignore values for unknown subscriptions or the wrong control', () => {
			const fb1 = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' })

			entityManager.trackEntity(fb1 as any, 'control-1')
			vi.runAllTimers()

			entityManager.handleFeedbackValues([
				{ id: 'unknown', controlId: 'control-1', value: true },
				{ id: entityManager.getSubscriptionId('fb-1')!, controlId: 'control-2', value: true },
			])

			expect(mockControlsController.updateFeedbackValues).not.toHaveBeenCalled()
		})

		it('should give an entity joining a subscription its current value, without telling the module', () => {
			const fb1 = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' })
			const fb2 = createMockEntity('fb-2', EntityModelType.Feedback, { field1: 'a' })

			entityManager.trackEntity(fb1 as any, 'control-1')
			vi.runAllTimers()
			entityManager.handleFeedbackValues([
				{ id: entityManager.getSubscriptionId('fb-1')!, controlId: 'control-1', value: 42 },
			])
			mockAdapter.updateFeedbacks.mockClear()
			mockControlsController.updateFeedbackValues.mockClear()

			entityManager.trackEntity(fb2 as any, 'control-1')
			vi.runAllTimers()

			expect(mockAdapter.updateFeedbacks).not.toHaveBeenCalled()
			expect(mockControlsController.updateFeedbackValues).toHaveBeenCalledWith('test-connection-id', [
				{ entityId: 'fb-2', controlId: 'control-1', value: 42 },
			])
		})

		it('should not give a value to an entity joining a subscription which has no value yet', () => {
			const fb1 = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' })
			const fb2 = createMockEntity('fb-2', EntityModelType.Feedback, { field1: 'a' })

			entityManager.trackEntity(fb1 as any, 'control-1')
			vi.runAllTimers()
			entityManager.trackEntity(fb2 as any, 'control-1')
			vi.runAllTimers()

			expect(mockControlsController.updateFeedbackValues).not.toHaveBeenCalled()
		})

		it('should delete the subscription only when the last member leaves', () => {
			const fb1 = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' })
			const fb2 = createMockEntity('fb-2', EntityModelType.Feedback, { field1: 'a' })

			entityManager.trackEntity(fb1 as any, 'control-1')
			entityManager.trackEntity(fb2 as any, 'control-1')
			vi.runAllTimers()
			mockAdapter.updateFeedbacks.mockClear()
			const subscriptionId = entityManager.getSubscriptionId('fb-1')!

			// The first member leaving keeps the subscription for the other
			entityManager.forgetEntity('fb-1')
			vi.runAllTimers()
			expect(mockAdapter.updateFeedbacks).not.toHaveBeenCalled()

			// Values now only go to the remaining member
			entityManager.handleFeedbackValues([{ id: subscriptionId, controlId: 'control-1', value: true }])
			expect(mockControlsController.updateFeedbackValues).toHaveBeenCalledWith('test-connection-id', [
				{ entityId: 'fb-2', controlId: 'control-1', value: true },
			])

			// The last member leaving deletes it
			entityManager.forgetEntity('fb-2')
			vi.runAllTimers()
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledWith(new Map([[subscriptionId, null]]))
		})

		it('should not reuse the value of a deleted subscription when it is created again', () => {
			const fb1 = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' })

			entityManager.trackEntity(fb1 as any, 'control-1')
			vi.runAllTimers()
			const subscriptionId = entityManager.getSubscriptionId('fb-1')!
			entityManager.handleFeedbackValues([{ id: subscriptionId, controlId: 'control-1', value: true }])
			entityManager.forgetEntity('fb-1')
			vi.runAllTimers()
			mockAdapter.updateFeedbacks.mockClear()
			mockControlsController.updateFeedbackValues.mockClear()

			entityManager.trackEntity(fb1 as any, 'control-1')
			vi.runAllTimers()

			const newSubscriptionId = entityManager.getSubscriptionId('fb-1')!
			expect(newSubscriptionId).not.toBe(subscriptionId)
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledWith(new Map([[newSubscriptionId, expect.anything()]]))
			expect(mockControlsController.updateFeedbackValues).not.toHaveBeenCalled()
		})

		it('should move an entity to a new subscription when its options change', () => {
			const fb1 = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' })
			const fb2 = createMockEntity('fb-2', EntityModelType.Feedback, { field1: 'a' })

			entityManager.trackEntity(fb1 as any, 'control-1')
			entityManager.trackEntity(fb2 as any, 'control-1')
			vi.runAllTimers()
			mockAdapter.updateFeedbacks.mockClear()
			const oldSubscriptionId = entityManager.getSubscriptionId('fb-1')!

			// fb-2 now parses to something else
			const fb2Changed = createMockEntity('fb-2', EntityModelType.Feedback, { field1: 'b' })
			entityManager.trackEntity(fb2Changed as any, 'control-1')
			vi.runAllTimers()

			// A new subscription is made, and the old one is kept for fb-1
			const newSubscriptionId = entityManager.getSubscriptionId('fb-2')!
			expect(newSubscriptionId).not.toBe(oldSubscriptionId)
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledWith(
				new Map([[newSubscriptionId, expect.objectContaining({ parsedOptions: { field1: 'b' } })]])
			)
			expect(entityManager.getSubscriptionId('fb-1')).toBe(oldSubscriptionId)

			// Values are routed by the new membership
			entityManager.handleFeedbackValues([
				{ id: oldSubscriptionId, controlId: 'control-1', value: 'old' },
				{ id: newSubscriptionId, controlId: 'control-1', value: 'new' },
			])
			expect(mockControlsController.updateFeedbackValues).toHaveBeenCalledWith('test-connection-id', [
				{ entityId: 'fb-1', controlId: 'control-1', value: 'old' },
				{ entityId: 'fb-2', controlId: 'control-1', value: 'new' },
			])
			mockAdapter.updateFeedbacks.mockClear()
			mockControlsController.updateFeedbackValues.mockClear()

			// fb-1 changes to match fb-2, so the old subscription is deleted and fb-1 gets the current value
			const fb1Changed = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'b' })
			entityManager.trackEntity(fb1Changed as any, 'control-1')
			vi.runAllTimers()

			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledWith(new Map([[oldSubscriptionId, null]]))
			expect(mockControlsController.updateFeedbackValues).toHaveBeenCalledWith('test-connection-id', [
				{ entityId: 'fb-1', controlId: 'control-1', value: 'new' },
			])
			expect(entityManager.getSubscriptionId('fb-1')).toBe(newSubscriptionId)
		})

		it('should update the subscription of a sole member in place when its options change', () => {
			const action = createMockEntity('action-1', EntityModelType.Action, { field1: 'a' })
			const actionChanged = createMockEntity('action-1', EntityModelType.Action, { field1: 'b' })

			entityManager.trackEntity(action as any, 'control-1')
			vi.runAllTimers()
			mockAdapter.updateActions.mockClear()
			const subscriptionId = entityManager.getSubscriptionId('action-1')!

			entityManager.trackEntity(actionChanged as any, 'control-1')
			vi.runAllTimers()

			expect(entityManager.getSubscriptionId('action-1')).toBe(subscriptionId)
			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map([[subscriptionId, expect.objectContaining({ parsedOptions: { field1: 'b' } })]])
			)
		})

		it('should update a shared subscription in place when all of its members change together', () => {
			const fb1 = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' })
			const fb2 = createMockEntity('fb-2', EntityModelType.Feedback, { field1: 'a' })

			entityManager.trackEntity(fb1 as any, 'control-1')
			entityManager.trackEntity(fb2 as any, 'control-1')
			vi.runAllTimers()
			mockAdapter.updateFeedbacks.mockClear()
			const subscriptionId = entityManager.getSubscriptionId('fb-1')!

			entityManager.trackEntity(createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'b' }) as any, 'control-1')
			entityManager.trackEntity(createMockEntity('fb-2', EntityModelType.Feedback, { field1: 'b' }) as any, 'control-1')
			vi.runAllTimers()

			expect(entityManager.getSubscriptionId('fb-1')).toBe(subscriptionId)
			expect(entityManager.getSubscriptionId('fb-2')).toBe(subscriptionId)
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledTimes(1)
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledWith(
				new Map([[subscriptionId, expect.objectContaining({ parsedOptions: { field1: 'b' } })]])
			)
		})

		it('should update the subscription of the last member in place after the others have moved', () => {
			const fb1 = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' })
			const fb2 = createMockEntity('fb-2', EntityModelType.Feedback, { field1: 'a' })

			entityManager.trackEntity(fb1 as any, 'control-1')
			entityManager.trackEntity(fb2 as any, 'control-1')
			vi.runAllTimers()
			const subscriptionId = entityManager.getSubscriptionId('fb-1')!

			// fb-2 splits off first
			entityManager.trackEntity(createMockEntity('fb-2', EntityModelType.Feedback, { field1: 'b' }) as any, 'control-1')
			vi.runAllTimers()
			mockAdapter.updateFeedbacks.mockClear()

			// fb-1 is now the only member, so its subscription follows it
			entityManager.trackEntity(createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'c' }) as any, 'control-1')
			vi.runAllTimers()

			expect(entityManager.getSubscriptionId('fb-1')).toBe(subscriptionId)
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledWith(
				new Map([[subscriptionId, expect.objectContaining({ parsedOptions: { field1: 'c' } })]])
			)
		})

		it('should swap subscriptions without telling the module when members swap options', () => {
			const fb1 = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' })
			const fb2 = createMockEntity('fb-2', EntityModelType.Feedback, { field1: 'b' })

			entityManager.trackEntity(fb1 as any, 'control-1')
			entityManager.trackEntity(fb2 as any, 'control-1')
			vi.runAllTimers()
			const subscriptionIdA = entityManager.getSubscriptionId('fb-1')!
			const subscriptionIdB = entityManager.getSubscriptionId('fb-2')!
			entityManager.handleFeedbackValues([
				{ id: subscriptionIdA, controlId: 'control-1', value: 'a' },
				{ id: subscriptionIdB, controlId: 'control-1', value: 'b' },
			])
			mockAdapter.updateFeedbacks.mockClear()
			mockControlsController.updateFeedbackValues.mockClear()

			entityManager.trackEntity(createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'b' }) as any, 'control-1')
			entityManager.trackEntity(createMockEntity('fb-2', EntityModelType.Feedback, { field1: 'a' }) as any, 'control-1')
			vi.runAllTimers()

			expect(mockAdapter.updateFeedbacks).not.toHaveBeenCalled()
			expect(entityManager.getSubscriptionId('fb-1')).toBe(subscriptionIdB)
			expect(entityManager.getSubscriptionId('fb-2')).toBe(subscriptionIdA)
			expect(mockControlsController.updateFeedbackValues).toHaveBeenCalledWith('test-connection-id', [
				{ entityId: 'fb-1', controlId: 'control-1', value: 'b' },
				{ entityId: 'fb-2', controlId: 'control-1', value: 'a' },
			])
		})

		it('should not give the value from before an in place update to an entity joining it', () => {
			const fb1 = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' })

			entityManager.trackEntity(fb1 as any, 'control-1')
			vi.runAllTimers()
			entityManager.handleFeedbackValues([
				{ id: entityManager.getSubscriptionId('fb-1')!, controlId: 'control-1', value: 'old' },
			])
			entityManager.trackEntity(createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'b' }) as any, 'control-1')
			vi.runAllTimers()
			mockControlsController.updateFeedbackValues.mockClear()

			// fb-2 joins before the module has reported a value for the new options
			entityManager.trackEntity(createMockEntity('fb-2', EntityModelType.Feedback, { field1: 'b' }) as any, 'control-1')
			vi.runAllTimers()

			expect(entityManager.getSubscriptionId('fb-2')).toBe(entityManager.getSubscriptionId('fb-1'))
			expect(mockControlsController.updateFeedbackValues).not.toHaveBeenCalled()
		})

		it('should not resend the subscription when members are re-parsed to the same options', () => {
			const fb1 = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' })
			const fb2 = createMockEntity('fb-2', EntityModelType.Feedback, { field1: 'a' })

			entityManager.trackEntity(fb1 as any, 'control-1')
			entityManager.trackEntity(fb2 as any, 'control-1')
			vi.runAllTimers()
			mockAdapter.updateFeedbacks.mockClear()

			entityManager.onVariablesChanged(new Set(['var1']), null)
			vi.runAllTimers()

			// Both members re-parse to the same subscription, which the module already has
			expect(mockVariablesParser.parseEntityOptions).toHaveBeenCalledTimes(4)
			expect(mockAdapter.updateFeedbacks).not.toHaveBeenCalled()

			// Unless something not covered by the options has changed
			entityManager.resendFeedbacks()
			vi.runAllTimers()
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledTimes(1)
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledWith(
				new Map([[entityManager.getSubscriptionId('fb-1'), expect.anything()]])
			)
		})

		it('should resend unchanged subscriptions when the definitions change', () => {
			const action = createMockEntity('action-1', EntityModelType.Action, { field1: 'a' })

			entityManager.trackEntity(action as any, 'control-1')
			vi.runAllTimers()
			mockAdapter.updateActions.mockClear()

			entityManager.onEntityDefinitionsChanged(EntityModelType.Action)
			vi.runAllTimers()

			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map([[entityManager.getSubscriptionId('action-1'), expect.anything()]])
			)
		})

		it('should leave the subscription when an entity becomes disabled', () => {
			const fb1 = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' })

			entityManager.trackEntity(fb1 as any, 'control-1')
			vi.runAllTimers()
			mockAdapter.updateFeedbacks.mockClear()
			const subscriptionId = entityManager.getSubscriptionId('fb-1')!

			const fb1Disabled = { ...createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' }), disabled: true }
			entityManager.trackEntity(fb1Disabled as any, 'control-1')
			vi.runAllTimers()

			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledWith(new Map([[subscriptionId, null]]))
			expect(entityManager.getSubscriptionId('fb-1')).toBeUndefined()
		})

		it('should forget all subscriptions when destroyed', () => {
			const fb1 = createMockEntity('fb-1', EntityModelType.Feedback, { field1: 'a' })

			entityManager.trackEntity(fb1 as any, 'control-1')
			vi.runAllTimers()
			const subscriptionId = entityManager.getSubscriptionId('fb-1')!
			entityManager.destroy()

			entityManager.handleFeedbackValues([{ id: subscriptionId, controlId: 'control-1', value: true }])
			expect(mockControlsController.updateFeedbackValues).not.toHaveBeenCalled()
		})
	})
})
