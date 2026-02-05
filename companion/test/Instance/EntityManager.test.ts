import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
	ConnectionEntityManager,
	EntityManagerActionEntity,
	EntityManagerAdapter,
	EntityManagerFeedbackEntity,
} from '../../lib/Instance/Connection/EntityManager.js'
import {
	EntityModelType,
	ReplaceableActionEntityModel,
	ReplaceableFeedbackEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import { CompanionOptionValues } from '@companion-module/host'

// Mock dependencies
vi.mock('nanoid', () => ({
	nanoid: vi.fn().mockReturnValue('mock-id'),
}))

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
			entityReplace: vi.fn(),
		},
		supportsEntities: true,
		getBitmapSize: vi.fn().mockReturnValue({ width: 72, height: 58 }),
	}

	const mockVariablesParser = {
		parseEntityOptions: vi.fn().mockImplementation((entityDefinition, options) => {
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
	}

	let entityManager: ConnectionEntityManager

	// Reset mocks before each test
	beforeEach(() => {
		vi.clearAllMocks()

		// Reset mock implementations to defaults (clearAllMocks only clears call history)
		mockVariablesParser.parseEntityOptions.mockImplementation((entityDefinition, options) => {
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
		entityManager = new ConnectionEntityManager(mockAdapter as any, mockControlsController as any, 'test-connection-id')

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
					[
						'entity-1',
						{
							controlId: 'control-1',
							entity: {
								id: 'entity-1',
								type: EntityModelType.Action,
								definitionId: 'action-1',
								connectionId: 'connection-1',
								options: {},
							} as any,
							parsedOptions: {},
						} satisfies EntityManagerActionEntity,
					],
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

			entityManager.start(5)
			entityManager.trackEntity(mockEntity1 as any, 'control-1')

			// Clear calls from first entity
			vi.runAllTimers()
			mockAdapter.updateActions.mockClear()

			// Track replacement entity
			entityManager.trackEntity(mockEntity2 as any, 'control-1')
			vi.runAllTimers()

			// Verify the replacement was processed
			expect(mockEntity2.asEntityModel).toHaveBeenCalled()
			expect(mockAdapter.updateFeedbacks).not.toHaveBeenCalled()
			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map<string, EntityManagerActionEntity | null>([
					[
						'entity-1',
						{
							controlId: 'control-1',
							entity: {
								id: 'entity-1',
								type: EntityModelType.Action,
								definitionId: 'action-1',
								connectionId: 'connection-1',
								options: { replaced: true },
							} as any,
							parsedOptions: { replaced: 'value-0' },
						} satisfies EntityManagerActionEntity,
					],
				])
			)
		})
	})

	describe('trackEntity for feedback', () => {
		it('should add a feedback entity and include image size', () => {
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

			expect(mockControlsController.getControl).toHaveBeenCalledWith('control-1')
			expect(mockControl.getBitmapSize).toHaveBeenCalled()

			expect(mockAdapter.updateActions).not.toHaveBeenCalled()
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledWith(
				new Map<string, EntityManagerFeedbackEntity | null>([
					[
						'feedback-1',
						{
							controlId: 'control-1',
							entity: {
								id: 'feedback-1',
								type: EntityModelType.Feedback,
								definitionId: 'feedback-def-1',
								connectionId: 'connection-1',
								options: {},
							} as any,
							parsedOptions: {},
							imageSize: { width: 72, height: 58 },
						} satisfies EntityManagerFeedbackEntity,
					],
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
			entityManager.forgetEntity('entity-1')

			vi.runAllTimers()

			// Should have been called with null for the entity
			expect(mockAdapter.updateFeedbacks).not.toHaveBeenCalled()
			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map<string, EntityManagerActionEntity | null>([['entity-1', null]])
			)
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
					[
						'feedback-1',
						{
							controlId: 'control-1',
							entity: {
								id: 'feedback-1',
								type: EntityModelType.Feedback,
								definitionId: 'feedback-def-1',
								connectionId: 'connection-1',
								options: {},
							} as any,
							parsedOptions: {},
							imageSize: { width: 72, height: 58 },
						} satisfies EntityManagerFeedbackEntity,
					],
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

			// Force feedback-2 to be forgotten
			entityManager.forgetEntity('feedback-2')

			// Now resend feedbacks
			entityManager.resendFeedbacks()
			vi.runAllTimers()

			// Should have been called with the appropriate feedbacks
			expect(mockAdapter.updateActions).not.toHaveBeenCalled()
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledWith(
				new Map<string, EntityManagerFeedbackEntity | null>([
					[
						'feedback-1',
						{
							controlId: 'control-1',
							entity: {
								id: 'feedback-1',
								type: EntityModelType.Feedback,
								definitionId: 'feedback-def-1',
								connectionId: 'connection-1',
								options: {},
							} as any,
							parsedOptions: {},
							imageSize: { width: 72, height: 58 },
						} satisfies EntityManagerFeedbackEntity,
					],
					['feedback-2', null],
					[
						'feedback-3',
						{
							controlId: 'control-3',
							entity: {
								id: 'feedback-3',
								type: EntityModelType.Feedback,
								definitionId: 'feedback-def-1',
								connectionId: 'connection-1',
								options: {},
							} as any,
							parsedOptions: {},
							imageSize: { width: 72, height: 58 },
						} satisfies EntityManagerFeedbackEntity,
					],
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

			// Simulate variables changing
			entityManager.onVariablesChanged(new Set(['var1']), null)
			vi.runAllTimers()

			// Verify it triggered a re-process
			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map<string, EntityManagerActionEntity | null>([
					[
						'entity-1',
						{
							controlId: 'control-1',
							entity: {
								id: 'entity-1',
								type: EntityModelType.Action,
								definitionId: 'action-1',
								connectionId: 'connection-1',
								options: { field1: '$(var:test)' },
							} as any,
							parsedOptions: { field1: 'value-0' },
						} satisfies EntityManagerActionEntity,
					],
				])
			)
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

			// Simulate variables changing for only control-1
			entityManager.onVariablesChanged(new Set(['var1']), 'control-1')
			vi.runAllTimers()

			// Should only have triggered a re-process for entity-1
			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map<string, EntityManagerActionEntity | null>([
					[
						'entity-1',
						{
							controlId: 'control-1',
							entity: {
								id: 'entity-1',
								type: EntityModelType.Action,
								definitionId: 'action-1',
								connectionId: 'connection-1',
								options: { field1: '$(var:test)' },
							} as any,
							parsedOptions: { field1: '$(var:test)' },
						} satisfies EntityManagerActionEntity,
					],
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

			// Simulate variables changing for only control-2
			entityManager.onVariablesChanged(new Set(['control-var']), 'control-2')
			vi.runAllTimers()

			// Should only have triggered a re-process for entity-2, not entity-1
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledWith(
				new Map<string, EntityManagerFeedbackEntity | null>([
					[
						'entity-2',
						{
							controlId: 'control-2',
							entity: {
								id: 'entity-2',
								type: EntityModelType.Feedback,
								definitionId: 'feedback-2',
								connectionId: 'connection-1',
								options: { field1: '$(var:test)' },
							} as any,
							parsedOptions: { field1: '$(var:test)' },
							imageSize: { width: 72, height: 58 },
						} satisfies EntityManagerFeedbackEntity,
					],
				])
			)
			expect(mockAdapter.updateActions).not.toHaveBeenCalled()
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
					entityReplace: vi.fn(),
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

			// Verify that the entityReplace was called with the upgraded entity
			expect(mockControl.entities.entityReplace).toHaveBeenCalledWith(
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
					[
						'entity-2',
						{
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
						} satisfies EntityManagerActionEntity,
					],
				])
			)
		})

		it('should mark entity as inactive when parseEntityOptions throws an error', () => {
			// Setup parseEntityOptions to throw an error
			mockVariablesParser.parseEntityOptions.mockImplementationOnce(() => {
				throw new Error('Expression parsing failed')
			})

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

			// Should have been called with null to mark the entity as inactive
			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map<string, EntityManagerActionEntity | null>([['entity-1', null]])
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
					[
						'entity-1',
						{
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
						} satisfies EntityManagerActionEntity,
					],
				])
			)
		})

		it('should track referenced variables for entity invalidation with expressions', () => {
			// Setup parseEntityOptions to track specific variables
			mockVariablesParser.parseEntityOptions.mockImplementation(() => ({
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
			expect(mockAdapter.updateActions).toHaveBeenCalled()
		})

		it('should not invalidate entity when unrelated variables change with expressions', () => {
			// Setup parseEntityOptions to track specific variables
			mockVariablesParser.parseEntityOptions.mockImplementation(() => ({
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

			// Create multiple mock controls with proper getBitmapSize implementation
			for (let i = 0; i < entityCount; i++) {
				const controlId = `control-${i}`
				const isAction = i % 2 === 0

				// For feedback entities, ensure there's a proper control with getBitmapSize
				if (!isAction) {
					mockControlsController.getControl.mockImplementation((id) => {
						if (id === controlId) {
							return {
								...mockControl,
								getBitmapSize: vi.fn().mockReturnValue({ width: 72, height: 58 }),
							}
						}
						return mockControl
					})
				}

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
				entityManager.trackEntity(entity as any, `control-${i}`)
			})

			// Run debounced function
			vi.runAllTimers()

			// Find action call and verify it contains expected action entities
			const actionPayload: Map<string, EntityManagerActionEntity | null> = mockAdapter.updateActions.mock.calls[0][0]

			// Should have exactly the right number of action entities (half of entityCount)
			expect(actionPayload.size).toBe(Math.ceil(entityCount / 2))

			// Check a few specific actions
			expect(actionPayload.get('entity-0')).toEqual({
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
			expect(feedbackPayload.get('entity-1')).toEqual({
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
				imageSize: { width: 72, height: 58 },
			} satisfies EntityManagerFeedbackEntity)
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
			expect(mockControl.entities.entityReplace).not.toHaveBeenCalled()
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
					[
						'entity-with-lifecycle',
						{
							controlId: 'control-1',
							entity: {
								id: 'entity-with-lifecycle',
								type: EntityModelType.Action,
								definitionId: 'action-1',
								connectionId: 'connection-1',
								options: {},
							} as any,
							parsedOptions: {},
						} satisfies EntityManagerActionEntity,
					],
				])
			)

			// Should only be called once (for the entity with lifecycle functions)
			expect(mockAdapter.updateActions).toHaveBeenCalledTimes(1)
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledTimes(0)
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

			// Setup IPC wrapper to return after delay
			let resolvePromise: (value: any) => void
			const delayedPromise = new Promise((resolve) => {
				resolvePromise = resolve
			})

			mockAdapter.updateActions.mockReturnValueOnce(delayedPromise)

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
					[
						'feedback-1',
						{
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
							imageSize: { width: 72, height: 58 },
						} satisfies EntityManagerFeedbackEntity,
					],
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
				getBitmapSize: vi.fn().mockReturnValue({ width: 72, height: 58 }),
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
						imageSize: undefined,
					},
				] satisfies Omit<EntityManagerFeedbackEntity, 'parsedOptions'>[],
				5
			)

			// Should have sent entities that don't need upgrading to updateActions/updateFeedbacks
			expect(mockAdapter.updateActions).toHaveBeenCalledWith(
				new Map<string, EntityManagerActionEntity | null>([['entity-2', expect.anything()]])
			)
			expect(mockAdapter.updateFeedbacks).toHaveBeenCalledWith(
				new Map<string, EntityManagerActionEntity | null>([['entity-4', expect.anything()]])
			)
		})
	})
})
