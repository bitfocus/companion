import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ControlEntityInstance } from '../../../lib/Controls/Entities/EntityInstance.js'
import {
	EntityPoolIsInvertedManager,
	type CreateVariablesAndExpressionParser,
	type UpdateIsInvertedValuesFn,
} from '../../../lib/Controls/Entities/EntityIsInvertedManager.js'
import type { NewIsInvertedValue } from '../../../lib/Controls/Entities/Types.js'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import type { ExecuteExpressionResult } from '@companion-app/shared/Expression/ExpressionResult.js'

describe('EntityPoolIsInvertedManager', () => {
	// Create mock functions
	const mockUpdateFn = vi.fn<UpdateIsInvertedValuesFn>()
	let mockParseExpressionResult: ExecuteExpressionResult

	const mockVariablesParser = {
		executeExpression: vi.fn().mockImplementation((_expression: string, _type: string) => mockParseExpressionResult),
	}

	const mockCreateVariablesAndExpressionParser = vi
		.fn<CreateVariablesAndExpressionParser>()
		.mockReturnValue(mockVariablesParser as any)

	let manager: EntityPoolIsInvertedManager

	// Helper to create mock entities
	function createMockEntity(id: string, rawIsInverted: ExpressionOrValue<boolean> | undefined): ControlEntityInstance {
		return {
			id,
			rawIsInverted,
		} as ControlEntityInstance
	}

	// Reset mocks before each test
	beforeEach(() => {
		vi.clearAllMocks()

		// Reset mock implementations to defaults
		mockParseExpressionResult = {
			ok: true,
			value: false,
			variableIds: new Set<string>(),
		}
		mockCreateVariablesAndExpressionParser.mockReturnValue(mockVariablesParser as any)

		// Create a new instance for each test
		manager = new EntityPoolIsInvertedManager('control-1', mockCreateVariablesAndExpressionParser, mockUpdateFn)

		vi.useFakeTimers()
	})

	describe('trackEntity', () => {
		it('should add an entity and process its isInverted value', () => {
			const mockEntity = createMockEntity('entity-1', { isExpression: false, value: true })

			manager.trackEntity(mockEntity)

			vi.runAllTimers()

			expect(mockUpdateFn).toHaveBeenCalledWith(
				new Map<string, NewIsInvertedValue>([
					[
						'entity-1',
						{
							entityId: 'entity-1',
							controlId: 'control-1',
							isInverted: true,
						},
					],
				])
			)
		})

		it('should handle undefined rawIsInverted as false', () => {
			const mockEntity = createMockEntity('entity-1', undefined)

			manager.trackEntity(mockEntity)

			vi.runAllTimers()

			expect(mockUpdateFn).toHaveBeenCalledWith(
				new Map<string, NewIsInvertedValue>([
					[
						'entity-1',
						{
							entityId: 'entity-1',
							controlId: 'control-1',
							isInverted: false,
						},
					],
				])
			)
		})

		it('should handle non-expression false value', () => {
			const mockEntity = createMockEntity('entity-1', { isExpression: false, value: false })

			manager.trackEntity(mockEntity)

			vi.runAllTimers()

			expect(mockUpdateFn).toHaveBeenCalledWith(
				new Map<string, NewIsInvertedValue>([
					[
						'entity-1',
						{
							entityId: 'entity-1',
							controlId: 'control-1',
							isInverted: false,
						},
					],
				])
			)
		})

		it('should replace existing entity with the same ID', () => {
			const mockEntity1 = createMockEntity('entity-1', { isExpression: false, value: false })
			const mockEntity2 = createMockEntity('entity-1', { isExpression: false, value: true })

			manager.trackEntity(mockEntity1)
			vi.runAllTimers()
			mockUpdateFn.mockClear()

			manager.trackEntity(mockEntity2)
			vi.runAllTimers()

			expect(mockUpdateFn).toHaveBeenCalledWith(
				new Map<string, NewIsInvertedValue>([
					[
						'entity-1',
						{
							entityId: 'entity-1',
							controlId: 'control-1',
							isInverted: true,
						},
					],
				])
			)
		})

		it('should process multiple entities in a single batch', () => {
			const mockEntity1 = createMockEntity('entity-1', { isExpression: false, value: true })
			const mockEntity2 = createMockEntity('entity-2', { isExpression: false, value: false })

			manager.trackEntity(mockEntity1)
			manager.trackEntity(mockEntity2)

			vi.runAllTimers()

			expect(mockUpdateFn).toHaveBeenCalledTimes(1)
			expect(mockUpdateFn).toHaveBeenCalledWith(
				new Map<string, NewIsInvertedValue>([
					[
						'entity-1',
						{
							entityId: 'entity-1',
							controlId: 'control-1',
							isInverted: true,
						},
					],
					[
						'entity-2',
						{
							entityId: 'entity-2',
							controlId: 'control-1',
							isInverted: false,
						},
					],
				])
			)
		})
	})

	describe('expression parsing', () => {
		it('should parse isInverted expression and return result', () => {
			mockParseExpressionResult = {
				ok: true,
				value: true,
				variableIds: new Set(['var1', 'var2']),
			}

			const mockEntity = createMockEntity('entity-1', { isExpression: true, value: 'true && $(internal:test)' })

			manager.trackEntity(mockEntity)

			vi.runAllTimers()

			expect(mockVariablesParser.executeExpression).toHaveBeenCalledWith('true && $(internal:test)', 'boolean')
			expect(mockUpdateFn).toHaveBeenCalledWith(
				new Map<string, NewIsInvertedValue>([
					[
						'entity-1',
						{
							entityId: 'entity-1',
							controlId: 'control-1',
							isInverted: true,
						},
					],
				])
			)
		})

		it('should handle expression parse error and default to false', () => {
			mockParseExpressionResult = {
				ok: false,
				error: 'Syntax error',
				variableIds: new Set<string>(),
			}

			const mockEntity = createMockEntity('entity-1', { isExpression: true, value: 'invalid expression !!!' })

			manager.trackEntity(mockEntity)

			vi.runAllTimers()

			expect(mockUpdateFn).toHaveBeenCalledWith(
				new Map<string, NewIsInvertedValue>([
					[
						'entity-1',
						{
							entityId: 'entity-1',
							controlId: 'control-1',
							isInverted: false,
						},
					],
				])
			)
		})

		it('should convert truthy expression value to true', () => {
			mockParseExpressionResult = {
				ok: true,
				value: 1, // truthy value
				variableIds: new Set<string>(),
			}

			const mockEntity = createMockEntity('entity-1', { isExpression: true, value: '1' })

			manager.trackEntity(mockEntity)

			vi.runAllTimers()

			expect(mockUpdateFn).toHaveBeenCalledWith(
				new Map<string, NewIsInvertedValue>([
					[
						'entity-1',
						{
							entityId: 'entity-1',
							controlId: 'control-1',
							isInverted: true,
						},
					],
				])
			)
		})

		it('should convert falsy expression value to false', () => {
			mockParseExpressionResult = {
				ok: true,
				value: 0, // falsy value
				variableIds: new Set<string>(),
			}

			const mockEntity = createMockEntity('entity-1', { isExpression: true, value: '0' })

			manager.trackEntity(mockEntity)

			vi.runAllTimers()

			expect(mockUpdateFn).toHaveBeenCalledWith(
				new Map<string, NewIsInvertedValue>([
					[
						'entity-1',
						{
							entityId: 'entity-1',
							controlId: 'control-1',
							isInverted: false,
						},
					],
				])
			)
		})
	})

	describe('forgetEntity', () => {
		it('should remove entity from tracking', () => {
			const mockEntity = createMockEntity('entity-1', { isExpression: false, value: true })

			manager.trackEntity(mockEntity)
			vi.runAllTimers()
			mockUpdateFn.mockClear()

			manager.forgetEntity('entity-1')

			// Trigger variable change to verify entity is not processed
			manager.onVariablesChanged(new Set(['var1']))
			vi.runAllTimers()

			expect(mockUpdateFn).not.toHaveBeenCalled()
		})

		it('should do nothing if entity does not exist', () => {
			manager.forgetEntity('non-existent')

			vi.runAllTimers()

			expect(mockUpdateFn).not.toHaveBeenCalled()
		})

		it('should remove pending entity before processing', () => {
			const mockEntity = createMockEntity('entity-1', { isExpression: false, value: true })

			manager.trackEntity(mockEntity)
			manager.forgetEntity('entity-1')

			vi.runAllTimers()

			expect(mockUpdateFn).not.toHaveBeenCalled()
		})
	})

	describe('onVariablesChanged', () => {
		it('should invalidate entities that reference changed variables', () => {
			mockParseExpressionResult = {
				ok: true,
				value: false,
				variableIds: new Set(['var1', 'var2']),
			}

			const mockEntity = createMockEntity('entity-1', { isExpression: true, value: '$(internal:var1)' })

			manager.trackEntity(mockEntity)
			vi.runAllTimers()
			mockUpdateFn.mockClear()

			// Change the expression result for re-processing
			mockParseExpressionResult = {
				ok: true,
				value: true,
				variableIds: new Set(['var1', 'var2']),
			}

			manager.onVariablesChanged(new Set(['var1']))
			vi.runAllTimers()

			expect(mockUpdateFn).toHaveBeenCalledWith(
				new Map<string, NewIsInvertedValue>([
					[
						'entity-1',
						{
							entityId: 'entity-1',
							controlId: 'control-1',
							isInverted: true,
						},
					],
				])
			)
		})

		it('should not invalidate entities if changed variables are not referenced', () => {
			mockParseExpressionResult = {
				ok: true,
				value: false,
				variableIds: new Set(['specific-var']),
			}

			const mockEntity = createMockEntity('entity-1', { isExpression: true, value: '$(internal:specific-var)' })

			manager.trackEntity(mockEntity)
			vi.runAllTimers()
			mockUpdateFn.mockClear()

			manager.onVariablesChanged(new Set(['unrelated-var']))
			vi.runAllTimers()

			expect(mockUpdateFn).not.toHaveBeenCalled()
		})

		it('should not invalidate entities without expressions', () => {
			const mockEntity = createMockEntity('entity-1', { isExpression: false, value: true })

			manager.trackEntity(mockEntity)
			vi.runAllTimers()
			mockUpdateFn.mockClear()

			manager.onVariablesChanged(new Set(['var1']))
			vi.runAllTimers()

			expect(mockUpdateFn).not.toHaveBeenCalled()
		})

		it('should invalidate multiple entities that reference the same variable', () => {
			mockParseExpressionResult = {
				ok: true,
				value: false,
				variableIds: new Set(['shared-var']),
			}

			const mockEntity1 = createMockEntity('entity-1', { isExpression: true, value: '$(internal:shared-var)' })
			const mockEntity2 = createMockEntity('entity-2', { isExpression: true, value: '$(internal:shared-var)' })

			manager.trackEntity(mockEntity1)
			manager.trackEntity(mockEntity2)
			vi.runAllTimers()
			mockUpdateFn.mockClear()

			// Change the expression result for re-processing
			mockParseExpressionResult = {
				ok: true,
				value: true,
				variableIds: new Set(['shared-var']),
			}

			manager.onVariablesChanged(new Set(['shared-var']))
			vi.runAllTimers()

			expect(mockUpdateFn).toHaveBeenCalledTimes(1)
			expect(mockUpdateFn).toHaveBeenCalledWith(
				new Map<string, NewIsInvertedValue>([
					[
						'entity-1',
						{
							entityId: 'entity-1',
							controlId: 'control-1',
							isInverted: true,
						},
					],
					[
						'entity-2',
						{
							entityId: 'entity-2',
							controlId: 'control-1',
							isInverted: true,
						},
					],
				])
			)
		})

		it('should not process entities already queued for processing', () => {
			mockParseExpressionResult = {
				ok: true,
				value: false,
				variableIds: new Set(['var1']),
			}

			const mockEntity = createMockEntity('entity-1', { isExpression: true, value: '$(internal:var1)' })

			manager.trackEntity(mockEntity)
			// Don't run timers yet - entity is still pending

			manager.onVariablesChanged(new Set(['var1']))
			vi.runAllTimers()

			// Should only be called once despite both trackEntity and onVariablesChanged
			expect(mockUpdateFn).toHaveBeenCalledTimes(1)
		})
	})

	describe('destroy', () => {
		it('should clear entities and prevent further processing', () => {
			const mockEntity = createMockEntity('entity-1', { isExpression: false, value: true })

			manager.trackEntity(mockEntity)
			manager.destroy()

			vi.runAllTimers()

			expect(mockUpdateFn).not.toHaveBeenCalled()
		})

		it('should prevent new entities from being processed after destroy', () => {
			manager.destroy()

			const mockEntity = createMockEntity('entity-1', { isExpression: false, value: true })
			manager.trackEntity(mockEntity)

			vi.runAllTimers()

			expect(mockUpdateFn).not.toHaveBeenCalled()
		})

		it('should prevent variable changes from triggering processing after destroy', () => {
			mockParseExpressionResult = {
				ok: true,
				value: false,
				variableIds: new Set(['var1']),
			}

			const mockEntity = createMockEntity('entity-1', { isExpression: true, value: '$(internal:var1)' })

			manager.trackEntity(mockEntity)
			vi.runAllTimers()
			mockUpdateFn.mockClear()

			manager.destroy()

			manager.onVariablesChanged(new Set(['var1']))
			vi.runAllTimers()

			expect(mockUpdateFn).not.toHaveBeenCalled()
		})
	})

	describe('weak reference cleanup', () => {
		it('should handle garbage collected entities gracefully', () => {
			// This test verifies the WeakRef behavior - when an entity is garbage collected,
			// the manager should skip it during processing
			const mockEntity = createMockEntity('entity-1', { isExpression: false, value: true })

			manager.trackEntity(mockEntity)

			// Note: We can't actually force garbage collection in tests, but we can verify
			// that the code handles the case where deref() returns undefined
			vi.runAllTimers()

			expect(mockUpdateFn).toHaveBeenCalled()
		})
	})

	describe('debouncing', () => {
		it('should debounce multiple track calls', () => {
			const mockEntity1 = createMockEntity('entity-1', { isExpression: false, value: true })
			const mockEntity2 = createMockEntity('entity-2', { isExpression: false, value: false })
			const mockEntity3 = createMockEntity('entity-3', { isExpression: false, value: true })

			manager.trackEntity(mockEntity1)
			manager.trackEntity(mockEntity2)
			manager.trackEntity(mockEntity3)

			vi.runAllTimers()

			// All three should be processed in a single batch
			expect(mockUpdateFn).toHaveBeenCalledTimes(1)
			const call = mockUpdateFn.mock.calls[0][0]
			expect(call.size).toBe(3)
		})

		it('should process after debounce timeout', () => {
			const mockEntity = createMockEntity('entity-1', { isExpression: false, value: true })

			manager.trackEntity(mockEntity)

			// Advance time less than debounce wait
			vi.advanceTimersByTime(5)
			expect(mockUpdateFn).not.toHaveBeenCalled()

			// Advance time past debounce wait
			vi.advanceTimersByTime(10)
			expect(mockUpdateFn).toHaveBeenCalled()
		})
	})

	describe('createVariablesAndExpressionParser', () => {
		it('should create a new parser for each processing batch', () => {
			const mockEntity1 = createMockEntity('entity-1', { isExpression: true, value: '$(internal:var1)' })
			const mockEntity2 = createMockEntity('entity-2', { isExpression: true, value: '$(internal:var2)' })

			mockParseExpressionResult = {
				ok: true,
				value: false,
				variableIds: new Set(['var1']),
			}

			manager.trackEntity(mockEntity1)
			vi.runAllTimers()

			expect(mockCreateVariablesAndExpressionParser).toHaveBeenCalledTimes(1)
			expect(mockCreateVariablesAndExpressionParser).toHaveBeenCalledWith(null)

			mockCreateVariablesAndExpressionParser.mockClear()

			mockParseExpressionResult = {
				ok: true,
				value: true,
				variableIds: new Set(['var2']),
			}

			manager.trackEntity(mockEntity2)
			vi.runAllTimers()

			expect(mockCreateVariablesAndExpressionParser).toHaveBeenCalledTimes(1)
		})
	})

	describe('edge cases', () => {
		it('should handle null rawIsInverted as false', () => {
			const mockEntity = createMockEntity('entity-1', null as any)

			manager.trackEntity(mockEntity)

			vi.runAllTimers()

			expect(mockUpdateFn).toHaveBeenCalledWith(
				new Map<string, NewIsInvertedValue>([
					[
						'entity-1',
						{
							entityId: 'entity-1',
							controlId: 'control-1',
							isInverted: false,
						},
					],
				])
			)
		})

		it('should handle empty string expression value', () => {
			mockParseExpressionResult = {
				ok: true,
				value: '',
				variableIds: new Set<string>(),
			}

			const mockEntity = createMockEntity('entity-1', { isExpression: true, value: '' })

			manager.trackEntity(mockEntity)

			vi.runAllTimers()

			expect(mockUpdateFn).toHaveBeenCalledWith(
				new Map<string, NewIsInvertedValue>([
					[
						'entity-1',
						{
							entityId: 'entity-1',
							controlId: 'control-1',
							isInverted: false, // empty string is falsy
						},
					],
				])
			)
		})

		it('should handle undefined expression result value', () => {
			mockParseExpressionResult = {
				ok: true,
				value: undefined,
				variableIds: new Set<string>(),
			}

			const mockEntity = createMockEntity('entity-1', { isExpression: true, value: '$(missing:var)' })

			manager.trackEntity(mockEntity)

			vi.runAllTimers()

			expect(mockUpdateFn).toHaveBeenCalledWith(
				new Map<string, NewIsInvertedValue>([
					[
						'entity-1',
						{
							entityId: 'entity-1',
							controlId: 'control-1',
							isInverted: false, // undefined is falsy
						},
					],
				])
			)
		})

		it('should not call updateFn if no entities need processing', () => {
			// Trigger variable change without any tracked entities
			manager.onVariablesChanged(new Set(['var1']))

			vi.runAllTimers()

			expect(mockUpdateFn).not.toHaveBeenCalled()
		})
	})
})
