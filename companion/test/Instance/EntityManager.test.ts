import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InstanceEntityManager } from '../../lib/Instance/EntityManager.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { UpdateActionInstancesMessage } from '@companion-module/base/dist/host-api/api.js'

// Mock dependencies
vi.mock('nanoid', () => ({
	nanoid: vi.fn().mockReturnValue('mock-id'),
}))

describe('InstanceEntityManager', () => {
	// Create mock objects for dependencies
	const mockIpcWrapper = {
		sendWithCb: vi.fn().mockResolvedValue({
			updatedActions: [],
			updatedFeedbacks: [],
		}),
	}

	const mockControl = {
		entities: {
			entityReplace: vi.fn(),
		},
		supportsEntities: true,
		getBitmapSize: vi.fn().mockReturnValue({ width: 72, height: 58 }),
	}

	const mockVariablesParser = {
		parseVariables: vi.fn().mockReturnValue({
			text: 'parsed-value',
			variableIds: ['var1', 'var2'],
		}),
	}

	const mockControlsController = {
		getControl: vi.fn().mockReturnValue(mockControl),
		createVariablesAndExpressionParser: vi.fn().mockReturnValue(mockVariablesParser),
	}

	let entityManager: InstanceEntityManager

	// Reset mocks before each test
	beforeEach(() => {
		vi.clearAllMocks()
		// Create a new instance for each test
		entityManager = new InstanceEntityManager(
			mockIpcWrapper as any,
			mockControlsController as any,
			'test-connection-id'
		)

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
				}),
			}

			entityManager.start(5)
			entityManager.trackEntity(mockEntity as any, 'control-1')

			// Verify the entity is being processed
			vi.runAllTimers()

			expect(mockIpcWrapper.sendWithCb).toHaveBeenCalledWith('updateActions', {
				actions: {
					'entity-1': {
						id: 'entity-1',
						actionId: 'action-1',
						options: {},
						disabled: false,
						upgradeIndex: null,
						controlId: 'control-1',
					},
				},
			} satisfies UpdateActionInstancesMessage)
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
				}),
			}

			entityManager.start(5)
			entityManager.trackEntity(mockEntity1 as any, 'control-1')

			// Clear calls from first entity
			vi.runAllTimers()
			mockIpcWrapper.sendWithCb.mockClear()

			// Track replacement entity
			entityManager.trackEntity(mockEntity2 as any, 'control-1')
			vi.runAllTimers()

			// Verify the replacement was processed
			expect(mockEntity2.asEntityModel).toHaveBeenCalled()
			expect(mockIpcWrapper.sendWithCb).toHaveBeenCalledWith('updateActions', {
				actions: {
					'entity-1': {
						id: 'entity-1',
						actionId: 'action-1',
						options: { replaced: true },
						disabled: false,
						upgradeIndex: null,
						controlId: 'control-1',
					},
				},
			})
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
				}),
			}

			entityManager.start(5)
			entityManager.trackEntity(mockFeedback as any, 'control-1')

			// Verify the entity is being processed
			vi.runAllTimers()

			expect(mockControlsController.getControl).toHaveBeenCalledWith('control-1')
			expect(mockControl.getBitmapSize).toHaveBeenCalled()

			expect(mockIpcWrapper.sendWithCb).toHaveBeenCalledWith('updateFeedbacks', {
				feedbacks: {
					'feedback-1': {
						id: 'feedback-1',
						feedbackId: 'feedback-def-1',
						options: {},
						disabled: false,
						upgradeIndex: null,
						controlId: 'control-1',
						image: { width: 72, height: 58 },
						isInverted: false,
					},
				},
			})
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
				}),
			}

			entityManager.start(5)
			entityManager.trackEntity(mockEntity as any, 'control-1')
			entityManager.forgetEntity('entity-1')

			vi.runAllTimers()

			// Should have been called with null for the entity
			expect(mockIpcWrapper.sendWithCb).toHaveBeenCalledWith('updateActions', {
				actions: {
					'entity-1': null,
				},
			})
		})

		it('should do nothing if entity does not exist', () => {
			entityManager.start(5)
			entityManager.forgetEntity('non-existent')

			vi.runAllTimers()

			expect(mockIpcWrapper.sendWithCb).not.toHaveBeenCalled()
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
				}),
			}

			entityManager.start(5)
			entityManager.trackEntity(mockFeedback as any, 'control-1')

			// First clear the initial processing
			vi.runAllTimers()
			mockIpcWrapper.sendWithCb.mockClear()

			// Now resend feedbacks
			entityManager.resendFeedbacks()
			vi.runAllTimers()

			expect(mockIpcWrapper.sendWithCb).toHaveBeenCalledWith('updateFeedbacks', {
				feedbacks: {
					'feedback-1': {
						id: 'feedback-1',
						feedbackId: 'feedback-def-1',
						options: {},
						disabled: false,
						upgradeIndex: null,
						controlId: 'control-1',
						image: { width: 72, height: 58 },
						isInverted: false,
					},
				},
			})
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
			mockIpcWrapper.sendWithCb.mockClear()

			// Force feedback-2 to be forgotten
			entityManager.forgetEntity('feedback-2')

			// Now resend feedbacks
			entityManager.resendFeedbacks()
			vi.runAllTimers()

			// Should have been called with the appropriate feedbacks
			expect(mockIpcWrapper.sendWithCb).toHaveBeenCalledWith('updateFeedbacks', {
				feedbacks: {
					'feedback-1': {
						id: 'feedback-1',
						feedbackId: 'feedback-def-1',
						options: {},
						disabled: false,
						upgradeIndex: null,
						controlId: 'control-1',
						image: { width: 72, height: 58 },
						isInverted: false,
					},
					'feedback-2': null, // feedback-2 should be null
					'feedback-3': {
						id: 'feedback-3',
						feedbackId: 'feedback-def-1',
						options: {},
						disabled: false,
						upgradeIndex: null,
						controlId: 'control-3',
						image: { width: 72, height: 58 },
						isInverted: false,
					},
				},
			})
		})
	})

	describe('parseOptionsObject', () => {
		it('should return unchanged options if no entityDefinition provided', () => {
			const options = { key1: 'value1' }
			const result = entityManager.parseOptionsObject(undefined, options, 'control-1')

			expect(result).toEqual({
				parsedOptions: options,
				referencedVariableIds: expect.any(Set),
			})
			expect(result.referencedVariableIds.size).toBe(0)
		})

		it('should parse options with variables', () => {
			const entityDefinition = {
				options: [
					{ id: 'field1', type: 'textinput', useVariables: true },
					{ id: 'field2', type: 'dropdown' },
				],
			}
			const options = { field1: '$(var:text)', field2: 'option1' }

			const result = entityManager.parseOptionsObject(entityDefinition as any, options, 'control-1')

			expect(mockControlsController.createVariablesAndExpressionParser).toHaveBeenCalledWith('control-1', null)
			expect(mockVariablesParser.parseVariables).toHaveBeenCalledWith('$(var:text)')
			expect(result.parsedOptions).toEqual({
				field1: 'parsed-value',
				field2: 'option1',
			})
			expect(result.referencedVariableIds.has('var1')).toBe(true)
			expect(result.referencedVariableIds.has('var2')).toBe(true)
		})

		it('should pass through non-variable fields unchanged', () => {
			const entityDefinition = {
				options: [{ id: 'field1', type: 'number' }],
			}
			const options = { field1: 42 }

			const result = entityManager.parseOptionsObject(entityDefinition as any, options, 'control-1')

			expect(result.parsedOptions).toEqual({ field1: 42 })
			expect(mockControlsController.createVariablesAndExpressionParser).toHaveBeenCalledWith('control-1', null)
			expect(mockVariablesParser.parseVariables).not.toHaveBeenCalled()
		})

		it('should handle missing option values', () => {
			const entityDefinition = {
				options: [
					{ id: 'field1', type: 'textinput', useVariables: true },
					{ id: 'field2', type: 'dropdown' },
				],
			}
			const options = { field2: 'option1' } // field1 missing

			// For missing fields, parseVariables will be called with "undefined"
			// So we need to update our mock for this specific test case
			mockVariablesParser.parseVariables.mockReturnValueOnce({
				text: undefined,
				variableIds: [],
			})

			const result = entityManager.parseOptionsObject(entityDefinition as any, options, 'control-1')

			// field1 should be undefined in the parsed options
			expect(result.parsedOptions).toEqual({
				field1: undefined,
				field2: 'option1',
			})

			// parseVariables should be called with "undefined" for the missing field
			expect(mockControlsController.createVariablesAndExpressionParser).toHaveBeenCalledWith('control-1', null)
			expect(mockVariablesParser.parseVariables).toHaveBeenCalledWith('undefined')
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
				}),
			}

			// Add entity to manager
			entityManager.start(5)
			entityManager.trackEntity(mockEntity as any, 'control-1')

			// Process the entity so it references variables
			vi.runAllTimers()
			mockIpcWrapper.sendWithCb.mockClear()

			// Simulate variables changing
			entityManager.onVariablesChanged(new Set(['var1']))
			vi.runAllTimers()

			// Verify it triggered a re-process
			expect(mockIpcWrapper.sendWithCb).toHaveBeenCalledWith('updateActions', {
				actions: {
					'entity-1': {
						id: 'entity-1',
						actionId: 'action-1',
						options: { field1: 'parsed-value' },
						disabled: false,
						upgradeIndex: null,
						controlId: 'control-1',
					},
				},
			})
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
				}),
			}

			// Customize parse variables to return specific variables
			mockVariablesParser.parseVariables.mockReturnValue({
				text: 'parsed-value',
				variableIds: ['specific-var'],
			})

			// Add entity to manager
			entityManager.start(5)
			entityManager.trackEntity(mockEntity as any, 'control-1')

			// Process the entity so it references variables
			vi.runAllTimers()
			mockIpcWrapper.sendWithCb.mockClear()

			// Simulate unrelated variables changing
			entityManager.onVariablesChanged(new Set(['unrelated-var']))
			vi.runAllTimers()

			// Should not have triggered a re-process
			expect(mockIpcWrapper.sendWithCb).not.toHaveBeenCalled()
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
				}),
			}

			entityManager.start(5)
			entityManager.trackEntity(mockEntity as any, 'control-1')

			vi.runAllTimers()

			// Should have called upgradeActionsAndFeedbacks
			expect(mockIpcWrapper.sendWithCb).toHaveBeenCalledWith(
				'upgradeActionsAndFeedbacks',
				expect.objectContaining({
					actions: expect.arrayContaining([
						expect.objectContaining({
							id: 'entity-1',
							upgradeIndex: 3,
						}),
					]),
					feedbacks: [],
				})
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
					options: { old: true },
					upgradeIndex: 3,
				}),
				getEntityDefinition: vi.fn().mockReturnValue({
					hasLifecycleFunctions: true,
					options: [],
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
			mockIpcWrapper.sendWithCb.mockImplementationOnce(async () => {
				return {
					updatedActions: [
						{
							id: 'entity-1',
							actionId: 'action-1',
							options: { upgraded: true },
							upgradeIndex: 5,
						},
					],
					updatedFeedbacks: [],
				}
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
					options: { upgraded: true },
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
				}),
			}

			entityManager.start(5)
			entityManager.trackEntity(mockEntity as any, 'control-1')

			entityManager.destroy()

			// After destroy, tracking a new entity should not call processing
			mockIpcWrapper.sendWithCb.mockClear()
			entityManager.trackEntity(mockEntity as any, 'control-1')
			vi.runAllTimers()

			expect(mockIpcWrapper.sendWithCb).not.toHaveBeenCalled()
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
				}),
			}

			// Setup the ipc to reject with an error
			mockIpcWrapper.sendWithCb.mockRejectedValueOnce(new Error('Upgrade failed'))

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
				}),
			}

			mockIpcWrapper.sendWithCb.mockClear()
			entityManager.trackEntity(mockEntity2 as any, 'control-1')
			vi.runAllTimers()

			// New entities should still be processed
			expect(mockIpcWrapper.sendWithCb).toHaveBeenCalledWith('updateActions', {
				actions: {
					'entity-2': {
						id: 'entity-2',
						actionId: 'action-2',
						options: {},
						disabled: false,
						upgradeIndex: 5,
						controlId: 'control-1',
					},
				},
			})
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
						options: { index: i },
						upgradeIndex: 5,
					}),
					getEntityDefinition: vi.fn().mockReturnValue({
						hasLifecycleFunctions: true,
						options: [{ id: 'index', type: 'number' }],
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

			// Get all the calls to sendWithCb
			const calls = mockIpcWrapper.sendWithCb.mock.calls

			// Find action call and verify it contains expected action entities
			const actionCall = calls.find((call) => call[0] === 'updateActions')
			expect(actionCall).toBeDefined()
			const actionPayload = actionCall![1].actions

			// Should have exactly the right number of action entities (half of entityCount)
			expect(Object.keys(actionPayload).length).toBe(Math.ceil(entityCount / 2))

			// Check a few specific actions
			expect(actionPayload['entity-0']).toEqual({
				id: 'entity-0',
				actionId: 'def-0',
				options: { index: 0 },
				disabled: false,
				upgradeIndex: 5,
				controlId: 'control-0',
			})

			// Find feedback call and verify it contains expected feedback entities
			const feedbackCall = calls.find((call) => call[0] === 'updateFeedbacks')
			expect(feedbackCall).toBeDefined()
			const feedbackPayload = feedbackCall![1].feedbacks

			// Should have exactly the right number of feedback entities (half of entityCount)
			expect(Object.keys(feedbackPayload).length).toBe(Math.floor(entityCount / 2))

			// Check a specific feedback
			expect(feedbackPayload['entity-1']).toEqual({
				id: 'entity-1',
				feedbackId: 'def-1',
				options: { index: 1 },
				disabled: false,
				upgradeIndex: 5,
				controlId: 'control-1',
				image: { width: 72, height: 58 },
				isInverted: false,
			})
		})
	})

	describe('Race Conditions', () => {
		it('should handle entity state transitions during asynchronous operations', async () => {
			// Create a delayed IPC response
			let resolvePromise: (value: any) => void
			const delayedPromise = new Promise((resolve) => {
				resolvePromise = resolve
			})

			mockIpcWrapper.sendWithCb.mockReturnValueOnce(delayedPromise)

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
				}),
			}

			entityManager.start(5)
			entityManager.trackEntity(mockEntity as any, 'control-1')
			vi.runAllTimers()

			// Should have passed the location to parse variables
			expect(mockControlsController.createVariablesAndExpressionParser).toHaveBeenCalledWith('control-1', null)
			expect(mockVariablesParser.parseVariables).toHaveBeenCalledWith('$(var:page_specific)')
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

			expect(mockIpcWrapper.sendWithCb).not.toHaveBeenCalled()
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
				}),
			}

			entityManager.start(5)
			entityManager.trackEntity(mockEntity as any, 'control-1')

			// Should skip the entity since it doesn't have lifecycle functions
			vi.runAllTimers()

			expect(mockIpcWrapper.sendWithCb).not.toHaveBeenCalled()
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
				}),
			}

			entityManager.start(5)
			entityManager.trackEntity(mockFeedback as any, 'control-1')

			// Should skip the feedback entity since it doesn't have lifecycle functions
			vi.runAllTimers()

			expect(mockIpcWrapper.sendWithCb).not.toHaveBeenCalled()
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
				}),
			}

			entityManager.start(5)
			entityManager.trackEntity(mockEntityWithLifecycle as any, 'control-1')
			entityManager.trackEntity(mockEntityWithoutLifecycle as any, 'control-2')

			vi.runAllTimers()

			// Only the entity with lifecycle functions should be sent to the module
			expect(mockIpcWrapper.sendWithCb).toHaveBeenCalledWith('updateActions', {
				actions: {
					'entity-with-lifecycle': {
						id: 'entity-with-lifecycle',
						actionId: 'action-1',
						options: {},
						disabled: false,
						upgradeIndex: null,
						controlId: 'control-1',
					},
				},
			})

			// Should only be called once (for the entity with lifecycle functions)
			expect(mockIpcWrapper.sendWithCb).toHaveBeenCalledTimes(1)
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
				}),
			}

			// Setup upgrade response
			mockIpcWrapper.sendWithCb.mockResolvedValueOnce({
				updatedActions: [],
				updatedFeedbacks: [],
			})

			entityManager.start(5)
			entityManager.trackEntity(mockEntityWithoutLifecycle as any, 'control-1')

			vi.runAllTimers()
			await vi.runAllTimersAsync()

			// Should call upgradeActionsAndFeedbacks first, but then ignore the result
			expect(mockIpcWrapper.sendWithCb).toHaveBeenCalledWith('upgradeActionsAndFeedbacks', {
				actions: [
					{
						id: 'entity-without-lifecycle',
						actionId: 'action-1',
						controlId: 'control-1',
						disabled: false,
						options: {},
						upgradeIndex: 3,
					},
				],
				feedbacks: [],
				defaultUpgradeIndex: 0,
			})

			// Should only be called once (for upgrade), not for regular processing
			expect(mockIpcWrapper.sendWithCb).toHaveBeenCalledTimes(1)
		})

		it('should handle disabled entities without sending them to the module', () => {
			const mockEntity = {
				id: 'entity-1',
				type: EntityModelType.Action,
				definitionId: 'action-1',
				disabled: true,
				asEntityModel: vi.fn().mockReturnValue({
					id: 'entity-1',
					type: EntityModelType.Action,
					definitionId: 'action-1',
					connectionId: 'connection-1',
					options: {},
					disabled: true,
				}),
				getEntityDefinition: vi.fn().mockReturnValue({
					hasLifecycleFunctions: true,
					options: [],
				}),
			}

			entityManager.start(5)
			entityManager.trackEntity(mockEntity as any, 'control-1')

			vi.runAllTimers()

			// Should send disabled: true to the module
			expect(mockIpcWrapper.sendWithCb).toHaveBeenCalledWith(
				'updateActions',
				expect.objectContaining({
					actions: expect.objectContaining({
						'entity-1': expect.objectContaining({
							disabled: true,
						}),
					}),
				})
			)
		})

		it('should handle entity with invalid option types', () => {
			const entityDefinition = {
				options: [{ id: 'field1', type: 'textinput', useVariables: true }],
			}

			// Test with option value that's not a string
			const options = {
				field1: { nestedObject: true },
			}

			mockVariablesParser.parseVariables.mockReturnValueOnce({
				text: 'parsed-object',
				variableIds: [],
			})

			const result = entityManager.parseOptionsObject(entityDefinition as any, options as any, 'control-1')

			// Should convert to string for parsing
			expect(mockControlsController.createVariablesAndExpressionParser).toHaveBeenCalledWith('control-1', null)
			expect(mockVariablesParser.parseVariables).toHaveBeenCalledWith('[object Object]')
			expect(result.parsedOptions).toEqual({
				field1: 'parsed-object',
			})
		})
	})

	describe('Batch processing', () => {
		it('should process multiple entities in one batch', () => {
			entityManager.start(5)

			// Create multiple action entities
			const actionEntities: any[] = []
			for (let i = 0; i < 5; i++) {
				actionEntities.push({
					id: `action-${i}`,
					type: EntityModelType.Action,
					definitionId: 'action-1',
					upgradeIndex: 5,
					asEntityModel: vi.fn().mockReturnValue({
						id: `action-${i}`,
						type: EntityModelType.Action,
						definitionId: 'action-1',
						connectionId: 'connection-1',
						options: { index: i },
					}),
					getEntityDefinition: vi.fn().mockReturnValue({
						hasLifecycleFunctions: true,
						options: [],
					}),
				})
			}

			// Track all entities
			actionEntities.forEach((entity) => {
				entityManager.trackEntity(entity as any, 'control-1')
			})

			// Should batch them into a single call
			vi.runAllTimers()

			// Only one call should have been made
			expect(mockIpcWrapper.sendWithCb).toHaveBeenCalledTimes(1)

			// It should contain all entities
			const call = mockIpcWrapper.sendWithCb.mock.calls[0]
			expect(call[0]).toBe('updateActions')

			const payload = call[1].actions
			expect(Object.keys(payload).length).toBe(5)
			for (let i = 0; i < 5; i++) {
				expect(payload[`action-${i}`]).toBeDefined()
			}
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
				}),
			}

			// Setup IPC wrapper to return after delay
			let resolvePromise: (value: any) => void
			const delayedPromise = new Promise((resolve) => {
				resolvePromise = resolve
			})

			mockIpcWrapper.sendWithCb.mockReturnValueOnce(delayedPromise)

			entityManager.start(5)
			entityManager.trackEntity(mockEntity as any, 'control-1')

			// Run initial process to send upgrade request
			vi.runAllTimers()

			// Entity is now in UPGRADING state

			// Call resendFeedbacks while entity is upgrading
			// This should mark feedbacks as UPGRADING_INVALIDATED
			mockIpcWrapper.sendWithCb.mockClear()

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
				}),
			}
			entityManager.trackEntity(mockFeedback as any, 'control-2')
			vi.runAllTimers()

			mockIpcWrapper.sendWithCb.mockClear()

			// Now resend feedbacks
			entityManager.resendFeedbacks()
			vi.runAllTimers()

			// Should have called updateFeedbacks
			expect(mockIpcWrapper.sendWithCb).toHaveBeenCalledWith('updateFeedbacks', {
				feedbacks: {
					'feedback-1': {
						id: 'feedback-1',
						feedbackId: 'feedback-def-1',
						options: {},
						disabled: false,
						upgradeIndex: 5,
						controlId: 'control-2',
						image: { width: 72, height: 58 },
						isInverted: false,
					},
				},
			})
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
					}),
				},
			]

			// Setup control mocks for each entity
			mockControlsController.getControl.mockImplementation(() => ({
				...mockControl,
				getBitmapSize: vi.fn().mockReturnValue({ width: 72, height: 58 }),
			}))

			// Setup IPC wrapper to return upgrade results
			mockIpcWrapper.sendWithCb.mockImplementationOnce(async () => {
				return {
					updatedActions: [
						{
							id: 'entity-1',
							actionId: 'action-1',
							options: { upgraded: true },
							upgradeIndex: 5,
						},
					],
					updatedFeedbacks: [
						{
							id: 'entity-3',
							feedbackId: 'feedback-1',
							options: { upgraded: true },
							upgradeIndex: 5,
						},
					],
				}
			})

			// Track all entities
			entities.forEach((entity) => {
				entityManager.trackEntity(entity as any, 'control-1')
			})

			vi.runAllTimers()
			await vi.runAllTimersAsync()

			// Should have sent entities that need upgrading to upgradeActionsAndFeedbacks
			expect(mockIpcWrapper.sendWithCb).toHaveBeenCalledWith(
				'upgradeActionsAndFeedbacks',
				expect.objectContaining({
					actions: expect.arrayContaining([
						expect.objectContaining({
							id: 'entity-1',
						}),
					]),
					feedbacks: expect.arrayContaining([
						expect.objectContaining({
							id: 'entity-3',
						}),
					]),
				})
			)

			// Should have sent entities that don't need upgrading to updateActions/updateFeedbacks
			expect(mockIpcWrapper.sendWithCb).toHaveBeenCalledWith(
				'updateActions',
				expect.objectContaining({
					actions: expect.objectContaining({
						'entity-2': expect.anything(),
					}),
				})
			)

			expect(mockIpcWrapper.sendWithCb).toHaveBeenCalledWith(
				'updateFeedbacks',
				expect.objectContaining({
					feedbacks: expect.objectContaining({
						'entity-4': expect.anything(),
					}),
				})
			)
		})
	})
})
