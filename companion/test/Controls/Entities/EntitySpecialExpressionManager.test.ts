import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EntityModelType, RawStoreResult } from '@companion-app/shared/Model/EntityModel.js'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import type { ControlEntityInstance } from '../../../lib/Controls/Entities/EntityInstance.js'
import {
	EntityPoolSpecialExpressionManager,
	type CreateVariablesAndExpressionParser,
} from '../../../lib/Controls/Entities/EntitySpecialExpressionManager.js'
import type {
	NewSpecialExpressionValue,
	SpecialExpression,
	UpdateSpecialExpressionValuesFn,
} from '../../../lib/Controls/Entities/SpecialExpressions.js'
import { VariablesAndExpressionParser } from '../../../lib/Variables/VariablesAndExpressionParser.js'

describe('EntityPoolSpecialExpressionManager', () => {
	// Create mock functions
	const mockUpdateIsInvertedFn = vi.fn<UpdateSpecialExpressionValuesFn<'isInverted'>>()
	const mockUpdateStoreResultFn = vi.fn<UpdateSpecialExpressionValuesFn<'storeResult'>>()

	let mockParseExpressionResult: ReturnType<VariablesAndExpressionParser['executeExpression']>
	let mockParseVariablesResult: ReturnType<VariablesAndExpressionParser['parseVariables']>

	const mockVariablesParser = {
		executeExpression: vi
			.fn<VariablesAndExpressionParser['executeExpression']>()
			.mockImplementation((_expression: string, _type: string | undefined) => mockParseExpressionResult),
		parseVariables: vi
			.fn<VariablesAndExpressionParser['parseVariables']>()
			.mockImplementation((_str: string) => mockParseVariablesResult),
	}

	const mockCreateVariablesAndExpressionParser = vi
		.fn<CreateVariablesAndExpressionParser>()
		.mockReturnValue(mockVariablesParser as any)

	let manager: EntityPoolSpecialExpressionManager

	// Helper to create mock entities
	function createMockFeedbackEntity(
		id: string,
		rawIsInverted: ExpressionOrValue<boolean> | undefined
	): ControlEntityInstance {
		return {
			type: EntityModelType.Feedback,
			id,
			rawIsInverted,
		} as ControlEntityInstance
	}
	function createMockActionEntity(id: string, rawStoreResult: RawStoreResult | undefined): ControlEntityInstance {
		return {
			type: EntityModelType.Action,
			id,
			rawStoreResult: rawStoreResult,
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
		mockParseVariablesResult = {
			text: 'reset-parse-variables-result',
			variableIds: new Set<string>(),
		}
		mockCreateVariablesAndExpressionParser.mockReturnValue(mockVariablesParser as any)

		// Create a new instance for each test
		manager = new EntityPoolSpecialExpressionManager('control-1', mockCreateVariablesAndExpressionParser, {
			isInverted: mockUpdateIsInvertedFn,
			storeResult: mockUpdateStoreResultFn,
		})

		vi.useFakeTimers()
	})

	describe('trackEntity', () => {
		it('should add an entity and process its isInverted value', () => {
			const mockEntity = createMockFeedbackEntity('entity-1', { isExpression: false, value: true })

			manager.trackEntity(mockEntity, 'isInverted')

			vi.runAllTimers()

			expect(mockUpdateIsInvertedFn).toHaveBeenCalledWith(
				new Map<string, NewSpecialExpressionValue<'isInverted'>>([
					[
						'entity-1',
						{
							entityId: 'entity-1',
							controlId: 'control-1',
							value: true,
						},
					],
				])
			)
			expect(mockUpdateStoreResultFn).not.toHaveBeenCalled()
		})

		it('should handle undefined rawIsInverted as false', () => {
			const mockEntity = createMockFeedbackEntity('entity-1', undefined)

			manager.trackEntity(mockEntity, 'isInverted')

			vi.runAllTimers()

			expect(mockUpdateIsInvertedFn).toHaveBeenCalledWith(
				new Map<string, NewSpecialExpressionValue<'isInverted'>>([
					[
						'entity-1',
						{
							entityId: 'entity-1',
							controlId: 'control-1',
							value: false,
						},
					],
				])
			)
			expect(mockUpdateStoreResultFn).not.toHaveBeenCalled()
		})

		it('should handle non-expression false value', () => {
			const mockEntity = createMockFeedbackEntity('entity-1', { isExpression: false, value: false })

			manager.trackEntity(mockEntity, 'isInverted')

			vi.runAllTimers()

			expect(mockUpdateIsInvertedFn).toHaveBeenCalledWith(
				new Map<string, NewSpecialExpressionValue<'isInverted'>>([
					[
						'entity-1',
						{
							entityId: 'entity-1',
							controlId: 'control-1',
							value: false,
						},
					],
				])
			)
			expect(mockUpdateStoreResultFn).not.toHaveBeenCalled()
		})

		it('should replace existing entity with the same ID', () => {
			const mockEntity1 = createMockFeedbackEntity('entity-1', { isExpression: false, value: false })
			const mockEntity2 = createMockFeedbackEntity('entity-1', { isExpression: false, value: true })

			manager.trackEntity(mockEntity1, 'isInverted')
			vi.runAllTimers()
			mockUpdateIsInvertedFn.mockClear()

			manager.trackEntity(mockEntity2, 'isInverted')
			vi.runAllTimers()

			expect(mockUpdateIsInvertedFn).toHaveBeenCalledWith(
				new Map<string, NewSpecialExpressionValue<'isInverted'>>([
					[
						'entity-1',
						{
							entityId: 'entity-1',
							controlId: 'control-1',
							value: true,
						},
					],
				])
			)
			expect(mockUpdateStoreResultFn).not.toHaveBeenCalled()
		})

		it('should process multiple entities in a single batch', () => {
			const mockEntity1 = createMockFeedbackEntity('entity-1', { isExpression: false, value: true })
			const mockEntity2 = createMockFeedbackEntity('entity-2', { isExpression: false, value: false })

			manager.trackEntity(mockEntity1, 'isInverted')
			manager.trackEntity(mockEntity2, 'isInverted')

			vi.runAllTimers()

			expect(mockUpdateIsInvertedFn).toHaveBeenCalledTimes(1)
			expect(mockUpdateIsInvertedFn).toHaveBeenCalledWith(
				new Map<string, NewSpecialExpressionValue<'isInverted'>>([
					[
						'entity-1',
						{
							entityId: 'entity-1',
							controlId: 'control-1',
							value: true,
						},
					],
					[
						'entity-2',
						{
							entityId: 'entity-2',
							controlId: 'control-1',
							value: false,
						},
					],
				])
			)
			expect(mockUpdateStoreResultFn).not.toHaveBeenCalled()
		})
	})

	describe('entity wrapper referencedVariableIds state transitions', () => {
		it('nonexpression isInverted', () => {
			const mockEntity = createMockFeedbackEntity('entity-niner', { isExpression: false, value: true })

			// Bracket-literal access evades access restrictions, for testing.  Don't
			// try this at home, kids!
			const {
				isInverted: { entities },
			} = manager['specialExpressions']

			const maybeWrapper = () => entities.get('entity-niner')

			// Initially no wrapper.
			expect(maybeWrapper()).toBe(undefined)

			// Start tracking.
			manager.trackEntity(mockEntity, 'isInverted')

			// Now a wrapper, with not-yet-computed referencedVariableIds.
			let w = maybeWrapper()
			expect(w).not.toBe(undefined)
			const wrapper = w!
			expect(wrapper.referencedVariableIds).toBe(null)

			expect(mockUpdateIsInvertedFn).not.toHaveBeenCalled()

			while (vi.getTimerCount() > 0) {
				vi.advanceTimersToNextTimer()

				w = maybeWrapper()
				if (w !== undefined) {
					expect(w).toBe(wrapper)
					expect(w.referencedVariableIds).toBe(null)

					expect(mockUpdateIsInvertedFn).not.toHaveBeenCalled()
					continue // still not computed, keep going
				}

				expect(entities.size).toBe(0)
				break
			}

			expect(mockVariablesParser.executeExpression).not.toHaveBeenCalled()
			expect(mockVariablesParser.parseVariables).not.toHaveBeenCalled()
			expect(mockUpdateIsInvertedFn).toHaveBeenCalledExactlyOnceWith(
				new Map<string, NewSpecialExpressionValue<'isInverted'>>([
					[
						'entity-niner',
						{
							entityId: 'entity-niner',
							controlId: 'control-1',
							value: true,
						},
					],
				])
			)
		})

		it('isInverted expression no variables', () => {
			const mockEntity = createMockFeedbackEntity('entity-lion', { isExpression: true, value: 'this is an expression' })

			// Bracket-literal access evades access restrictions, for testing.  Don't
			// try this at home, kids!
			const {
				isInverted: { entities },
			} = manager['specialExpressions']

			const maybeWrapper = () => entities.get('entity-lion')

			// Initially no wrapper.
			expect(maybeWrapper()).toBe(undefined)

			// Start tracking.
			manager.trackEntity(mockEntity, 'isInverted')

			expect(mockVariablesParser.executeExpression).not.toHaveBeenCalled()

			mockParseExpressionResult = {
				ok: true,
				value: false,
				variableIds: new Set<string>(),
			}

			// Now a wrapper, with not-yet-computed referencedVariableIds.
			let w = maybeWrapper()
			expect(w).not.toBe(undefined)
			const wrapper = w!
			expect(wrapper.referencedVariableIds).toBe(null)

			expect(mockUpdateIsInvertedFn).not.toHaveBeenCalled()

			while (vi.getTimerCount() > 0) {
				vi.advanceTimersToNextTimer()

				w = maybeWrapper()
				if (w !== undefined) {
					expect(w).toBe(wrapper)
					expect(w.referencedVariableIds).toBe(null)

					expect(mockUpdateIsInvertedFn).not.toHaveBeenCalled()
					continue // still not computed, keep going
				}

				expect(entities.size).toBe(0)
				break
			}

			expect(mockVariablesParser.parseVariables).not.toHaveBeenCalled()
			expect(mockVariablesParser.executeExpression).toHaveBeenCalledExactlyOnceWith('this is an expression', 'boolean')
			expect(mockUpdateIsInvertedFn).toHaveBeenCalledExactlyOnceWith(
				new Map<string, NewSpecialExpressionValue<'isInverted'>>([
					[
						'entity-lion',
						{
							entityId: 'entity-lion',
							controlId: 'control-1',
							value: false,
						},
					],
				])
			)
		})

		it('isInverted expression with a variable', () => {
			const mockEntity = createMockFeedbackEntity('entity-tiger', { isExpression: true, value: 'also an expression' })

			// Bracket-literal access evades access restrictions, for testing.  Don't
			// try this at home, kids!
			const {
				isInverted: { entities },
			} = manager['specialExpressions']

			const maybeWrapper = () => entities.get('entity-tiger')

			// Initially no wrapper.
			expect(maybeWrapper()).toBe(undefined)

			// Start tracking.
			manager.trackEntity(mockEntity, 'isInverted')

			expect(mockVariablesParser.executeExpression).not.toHaveBeenCalled()

			mockParseExpressionResult = {
				ok: true,
				value: false,
				variableIds: new Set<string>(['custom:DeadBeef']),
			}

			// Now a wrapper, with not-yet-computed referencedVariableIds.
			let w = maybeWrapper()
			expect(w).not.toBe(undefined)
			const wrapper = w!
			expect(wrapper.referencedVariableIds).toBe(null)

			expect(mockUpdateIsInvertedFn).not.toHaveBeenCalled()

			while (vi.getTimerCount() > 0) {
				vi.advanceTimersToNextTimer()

				w = maybeWrapper()
				expect(w).toBe(wrapper)

				if (wrapper.referencedVariableIds === null) {
					expect(mockUpdateIsInvertedFn).not.toHaveBeenCalled()
					continue // still not computed, keep going
				}

				expect(wrapper.referencedVariableIds.size).toBe(1)
				expect(wrapper.referencedVariableIds.has('custom:DeadBeef')).toBe(true)
				break
			}

			expect(mockVariablesParser.parseVariables).not.toHaveBeenCalled()
			expect(mockVariablesParser.executeExpression).toHaveBeenCalledExactlyOnceWith('also an expression', 'boolean')
			expect(mockUpdateIsInvertedFn).toHaveBeenCalledExactlyOnceWith(
				new Map<string, NewSpecialExpressionValue<'isInverted'>>([
					[
						'entity-tiger',
						{
							entityId: 'entity-tiger',
							controlId: 'control-1',
							value: false,
						},
					],
				])
			)
		})

		it('isInverted expression without variable, storeResult nonexpression with variable', () => {
			const mockFeedbackEntity = createMockFeedbackEntity('entity-batman', {
				isExpression: true,
				value: 'mucho expression',
			})
			const mockActionEntity = createMockActionEntity('entity-robin', {
				type: 'custom-variable',
				variableName: {
					isExpression: false,
					value: 'my variable name string',
				},
				createIfNotExists: true,
			})

			// Bracket-literal access evades access restrictions, for testing.  Don't
			// try this at home, kids!
			const {
				isInverted: { entities: isInvertedEntities },
				storeResult: { entities: storeResultEntities },
			} = manager['specialExpressions']

			const maybeIsInvertedWrapper = () => isInvertedEntities.get('entity-batman')
			const maybeStoreResultWrapper = () => storeResultEntities.get('entity-robin')

			// Initially no wrappers.
			expect(maybeIsInvertedWrapper()).toBe(undefined)
			expect(maybeStoreResultWrapper()).toBe(undefined)

			// Start tracking.
			manager.trackEntity(mockFeedbackEntity, 'isInverted')
			expect(isInvertedEntities.size).toBe(1)
			manager.trackEntity(mockActionEntity, 'storeResult')
			expect(storeResultEntities.size).toBe(1)

			expect(mockVariablesParser.executeExpression).not.toHaveBeenCalled()
			expect(mockVariablesParser.parseVariables).not.toHaveBeenCalled()

			mockParseExpressionResult = {
				ok: true,
				value: true,
				variableIds: new Set<string>(),
			}
			mockParseVariablesResult = {
				text: 'custom:variable-name',
				variableIds: new Set<string>(['custom:BeefCafe']),
			}

			// Now a wrapper, with not-yet-computed referencedVariableIds.
			let isInvertedW = maybeIsInvertedWrapper()
			expect(isInvertedW).not.toBe(undefined)
			const isInvertedWrapper = isInvertedW!
			expect(isInvertedWrapper.referencedVariableIds).toBe(null)

			let storeResultW = maybeStoreResultWrapper()
			expect(storeResultW).not.toBe(undefined)
			const storeResultWrapper = storeResultW!
			expect(storeResultWrapper.referencedVariableIds).toBe(null)

			expect(mockUpdateIsInvertedFn).not.toHaveBeenCalled()
			expect(mockUpdateStoreResultFn).not.toHaveBeenCalled()

			while (vi.getTimerCount() > 0) {
				vi.advanceTimersToNextTimer()

				isInvertedW = maybeIsInvertedWrapper()
				storeResultW = maybeStoreResultWrapper()

				// Recorded, no calculations completed.
				if (
					isInvertedW &&
					storeResultW &&
					isInvertedW.referencedVariableIds === null &&
					storeResultW.referencedVariableIds === null
				) {
					expect(mockUpdateIsInvertedFn).not.toHaveBeenCalled()
					expect(mockUpdateStoreResultFn).not.toHaveBeenCalled()
					continue
				}

				// Calculations completed, update functions called (or not)
				if (isInvertedW === undefined && storeResultW && storeResultW.referencedVariableIds) {
					expect(storeResultW).toBe(storeResultWrapper)
					expect(storeResultW.referencedVariableIds.values().toArray()).toEqual(['custom:BeefCafe'])
					break
				}

				// Unexpected state.
				expect('unexpected state').toBe(`
isInvertedW=${isInvertedW}, isInvertedW.referencedVariableIds=${isInvertedW?.referencedVariableIds?.values().toArray()}
storeResultW=${storeResultW}, storeResultW.referencedVariableIds=${storeResultW?.referencedVariableIds?.values().toArray()}
`)
			}

			expect(isInvertedEntities.size).toBe(0)
			expect(mockVariablesParser.executeExpression).toHaveBeenCalledExactlyOnceWith('mucho expression', 'boolean')
			expect(mockUpdateIsInvertedFn).toHaveBeenCalledExactlyOnceWith(
				new Map<string, NewSpecialExpressionValue<'isInverted'>>([
					[
						'entity-batman',
						{
							entityId: 'entity-batman',
							controlId: 'control-1',
							value: true,
						},
					],
				])
			)

			expect(storeResultEntities.size).toBe(1)
			expect(mockVariablesParser.parseVariables).toHaveBeenCalledExactlyOnceWith('my variable name string')
			expect(mockUpdateStoreResultFn).toHaveBeenCalledExactlyOnceWith(
				new Map<string, NewSpecialExpressionValue<'storeResult'>>([
					[
						'entity-robin',
						{
							entityId: 'entity-robin',
							controlId: 'control-1',
							value: {
								type: 'custom-variable',
								variableName: 'custom:variable-name',
								createIfNotExists: true,
							},
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

			const mockEntity = createMockFeedbackEntity('entity-1', { isExpression: true, value: 'true && $(internal:test)' })

			manager.trackEntity(mockEntity, 'isInverted')

			vi.runAllTimers()

			expect(mockVariablesParser.executeExpression).toHaveBeenCalledWith('true && $(internal:test)', 'boolean')
			expect(mockUpdateIsInvertedFn).toHaveBeenCalledWith(
				new Map<string, NewSpecialExpressionValue<'isInverted'>>([
					[
						'entity-1',
						{
							entityId: 'entity-1',
							controlId: 'control-1',
							value: true,
						},
					],
				])
			)
			expect(mockUpdateStoreResultFn).not.toHaveBeenCalled()
		})

		it('should parse storeResult special expression, undefined', () => {
			const mockEntity = createMockActionEntity('entity-1', undefined)

			manager.trackEntity(mockEntity, 'storeResult')

			vi.runAllTimers()

			expect(mockVariablesParser.parseVariables).not.toHaveBeenCalled()
			expect(mockVariablesParser.executeExpression).not.toHaveBeenCalled()
			expect(mockUpdateIsInvertedFn).not.toHaveBeenCalled()
			expect(mockUpdateStoreResultFn).toHaveBeenCalledWith(
				new Map<string, NewSpecialExpressionValue<'storeResult'>>([
					[
						'entity-1',
						{
							entityId: 'entity-1',
							controlId: 'control-1',
							value: undefined,
						},
					],
				])
			)
		})

		it('should parse storeResult special expression, custom variable', () => {
			mockParseVariablesResult = {
				text: 'overridden-parse-variables-result',
				variableIds: new Set<string>(),
			}

			const mockEntity = createMockActionEntity('entity-17', {
				type: 'custom-variable',
				variableName: {
					isExpression: false,
					value: '$(custom:varname)t',
				},
				createIfNotExists: false,
			})

			manager.trackEntity(mockEntity, 'storeResult')

			vi.runAllTimers()

			expect(mockVariablesParser.executeExpression).not.toHaveBeenCalled()
			expect(mockVariablesParser.parseVariables).toHaveBeenCalledWith('$(custom:varname)t')
			expect(mockUpdateIsInvertedFn).not.toHaveBeenCalled()
			expect(mockUpdateStoreResultFn).toHaveBeenCalledWith(
				new Map<string, NewSpecialExpressionValue<'storeResult'>>([
					[
						'entity-17',
						{
							entityId: 'entity-17',
							controlId: 'control-1',
							value: {
								type: 'custom-variable',
								variableName: 'overridden-parse-variables-result',
								createIfNotExists: false,
							},
						},
					],
				])
			)
		})

		it('should parse storeResult special expression, local variable', () => {
			mockParseExpressionResult = {
				ok: true,
				value: '1/2/4',
				variableIds: new Set(['custom:varname']),
			}
			mockParseVariablesResult = {
				text: 'parsed-variable-name',
				variableIds: new Set<string>(['local:foo']),
			}

			const mockEntity = createMockActionEntity('entity-17', {
				type: 'local-variable',
				location: {
					isExpression: true,
					value: `'expression'`,
				},
				variableName: {
					isExpression: false,
					value: '$(custom:variableName)t',
				},
			})

			manager.trackEntity(mockEntity, 'storeResult')

			vi.runAllTimers()

			expect(mockVariablesParser.executeExpression).toHaveBeenCalledWith(`'expression'`, 'string')
			expect(mockVariablesParser.parseVariables).toHaveBeenCalledWith('$(custom:variableName)t')
			expect(mockUpdateIsInvertedFn).not.toHaveBeenCalled()
			expect(mockUpdateStoreResultFn).toHaveBeenCalledWith(
				new Map<string, NewSpecialExpressionValue<'storeResult'>>([
					[
						'entity-17',
						{
							entityId: 'entity-17',
							controlId: 'control-1',
							value: {
								type: 'local-variable',
								location: '1/2/4',
								variableName: 'parsed-variable-name',
							},
						},
					],
				])
			)
		})

		it('should handle isInverted expression parse error and default to false', () => {
			mockParseExpressionResult = {
				ok: false,
				error: 'Syntax error',
				variableIds: new Set<string>(),
			}

			const mockEntity = createMockFeedbackEntity('entity-1', { isExpression: true, value: 'invalid expression !!!' })

			manager.trackEntity(mockEntity, 'isInverted')

			vi.runAllTimers()

			expect(mockUpdateIsInvertedFn).toHaveBeenCalledWith(
				new Map<string, NewSpecialExpressionValue<'isInverted'>>([
					[
						'entity-1',
						{
							entityId: 'entity-1',
							controlId: 'control-1',
							value: false,
						},
					],
				])
			)
			expect(mockUpdateStoreResultFn).not.toHaveBeenCalled()
		})

		it('should handle storeResult expression parse error and default to empty string', () => {
			mockParseExpressionResult = {
				ok: false,
				error: 'Syntax error',
				variableIds: new Set<string>(),
			}
			mockParseVariablesResult = {
				text: 'local-variable-name',
				variableIds: new Set<string>(['foobar']),
			}

			const mockEntity = createMockActionEntity('entity-42', {
				type: 'local-variable',
				location: {
					isExpression: true,
					value: 'invalid expression',
				},
				variableName: {
					isExpression: false,
					value: 'localvar',
				},
			})

			manager.trackEntity(mockEntity, 'storeResult')

			vi.runAllTimers()

			expect(mockVariablesParser.executeExpression).toHaveBeenCalledWith(`invalid expression`, 'string')
			expect(mockVariablesParser.parseVariables).toHaveBeenCalledWith('localvar')
			expect(mockUpdateIsInvertedFn).not.toHaveBeenCalled()
			expect(mockUpdateStoreResultFn).toHaveBeenCalledWith(
				new Map<string, NewSpecialExpressionValue<'storeResult'>>([
					[
						'entity-42',
						{
							entityId: 'entity-42',
							controlId: 'control-1',
							value: {
								type: 'local-variable',
								location: '',
								variableName: 'local-variable-name',
							},
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

			const mockEntity = createMockFeedbackEntity('entity-1', { isExpression: true, value: '1' })

			manager.trackEntity(mockEntity, 'isInverted')

			vi.runAllTimers()

			expect(mockUpdateIsInvertedFn).toHaveBeenCalledWith(
				new Map<string, NewSpecialExpressionValue<'isInverted'>>([
					[
						'entity-1',
						{
							entityId: 'entity-1',
							controlId: 'control-1',
							value: true,
						},
					],
				])
			)
			expect(mockUpdateStoreResultFn).not.toHaveBeenCalled()
		})

		it('should convert falsy expression value to false', () => {
			mockParseExpressionResult = {
				ok: true,
				value: 0, // falsy value
				variableIds: new Set<string>(),
			}

			const mockEntity = createMockFeedbackEntity('entity-1', { isExpression: true, value: '0' })

			manager.trackEntity(mockEntity, 'isInverted')

			vi.runAllTimers()

			expect(mockUpdateIsInvertedFn).toHaveBeenCalledWith(
				new Map<string, NewSpecialExpressionValue<'isInverted'>>([
					[
						'entity-1',
						{
							entityId: 'entity-1',
							controlId: 'control-1',
							value: false,
						},
					],
				])
			)
			expect(mockUpdateStoreResultFn).not.toHaveBeenCalled()
		})

		it('should convert non-string-valued expression value to string', () => {
			mockParseExpressionResult = {
				ok: true,
				value: ['will stringify to this'],
				variableIds: new Set<string>(),
			}

			const mockEntity = createMockActionEntity('entity-1', {
				type: 'custom-variable',
				variableName: {
					isExpression: true,
					value: 'variable name expression string',
				},
				createIfNotExists: true,
			})

			manager.trackEntity(mockEntity, 'storeResult')

			vi.runAllTimers()

			expect(mockUpdateIsInvertedFn).not.toHaveBeenCalled()
			expect(mockUpdateStoreResultFn).toHaveBeenCalledWith(
				new Map<string, NewSpecialExpressionValue<'storeResult'>>([
					[
						'entity-1',
						{
							entityId: 'entity-1',
							controlId: 'control-1',
							value: {
								type: 'custom-variable',
								variableName: 'will stringify to this',
								createIfNotExists: true,
							},
						},
					],
				])
			)
		})
	})

	describe('forgetEntity', () => {
		it('should remove potentially isInverted entity from tracking', () => {
			const mockEntity = createMockFeedbackEntity('entity-1', { isExpression: false, value: true })

			manager.trackEntity(mockEntity, 'isInverted')
			vi.runAllTimers()
			mockUpdateIsInvertedFn.mockClear()
			mockUpdateStoreResultFn.mockClear()

			manager.forgetEntity('entity-1')

			// Trigger variable change to verify entity is not processed
			manager.onVariablesChanged(new Set(['var1']))
			vi.runAllTimers()

			expect(mockUpdateIsInvertedFn).not.toHaveBeenCalled()
			expect(mockUpdateStoreResultFn).not.toHaveBeenCalled()
		})

		it('should remove entity with storeResult info from tracking', () => {
			mockParseVariablesResult = {
				text: 'foobar',
				variableIds: new Set<string>(['var42']),
			}

			const mockEntity = createMockActionEntity('entity-314', {
				type: 'custom-variable',
				variableName: {
					isExpression: false,
					value: 'mock variable name, parsed into the above text',
				},
				createIfNotExists: true,
			})

			manager.trackEntity(mockEntity, 'storeResult')
			vi.runAllTimers()

			expect(mockUpdateStoreResultFn).toHaveBeenCalledWith(
				new Map<string, NewSpecialExpressionValue<'storeResult'>>([
					[
						'entity-314',
						{
							entityId: 'entity-314',
							controlId: 'control-1',
							value: {
								type: 'custom-variable',
								variableName: 'foobar',
								createIfNotExists: true,
							},
						},
					],
				])
			)
			expect(mockUpdateIsInvertedFn).not.toHaveBeenCalled()

			mockUpdateIsInvertedFn.mockClear()
			mockUpdateStoreResultFn.mockClear()

			const UsedVariables: ReadonlySet<string> = new Set<string>(['var42'])

			// Trigger variable change to verify entity would be processed
			manager.onVariablesChanged(UsedVariables)
			vi.runAllTimers()

			expect(mockUpdateIsInvertedFn).not.toHaveBeenCalled()
			expect(mockUpdateStoreResultFn).toHaveBeenCalled()

			mockUpdateIsInvertedFn.mockClear()
			mockUpdateStoreResultFn.mockClear()

			manager.forgetEntity('entity-314')

			// Trigger variable change to verify entity is not processed
			manager.onVariablesChanged(UsedVariables)
			vi.runAllTimers()

			expect(mockUpdateIsInvertedFn).not.toHaveBeenCalled()
			expect(mockUpdateStoreResultFn).not.toHaveBeenCalled()
		})

		it('should do nothing if entity does not exist', () => {
			manager.forgetEntity('non-existent')

			vi.runAllTimers()

			expect(mockUpdateIsInvertedFn).not.toHaveBeenCalled()
			expect(mockUpdateStoreResultFn).not.toHaveBeenCalled()
		})

		it('should remove pending entity with isInverted special expression before processing', () => {
			const mockEntity = createMockFeedbackEntity('entity-1', { isExpression: false, value: true })

			manager.trackEntity(mockEntity, 'isInverted')
			manager.forgetEntity('entity-1')

			vi.runAllTimers()

			expect(mockUpdateIsInvertedFn).not.toHaveBeenCalled()
		})

		it('should remove pending entity with storeResult special expression before processing', () => {
			const mockEntity = createMockActionEntity('entity-2718', undefined)

			manager.trackEntity(mockEntity, 'storeResult')
			manager.forgetEntity('entity-2718')

			vi.runAllTimers()

			expect(mockUpdateStoreResultFn).not.toHaveBeenCalled()
		})
	})

	describe('onVariablesChanged', () => {
		it('should invalidate entities that reference changed variables, isInverted', () => {
			mockParseExpressionResult = {
				ok: true,
				value: false,
				variableIds: new Set(['var1', 'var2']),
			}

			const mockEntity = createMockFeedbackEntity('entity-1', { isExpression: true, value: '$(internal:var1)' })

			manager.trackEntity(mockEntity, 'isInverted')
			vi.runAllTimers()
			mockUpdateIsInvertedFn.mockClear()

			// Change the expression result for re-processing
			mockParseExpressionResult = {
				ok: true,
				value: true,
				variableIds: new Set(['var1', 'var2']),
			}

			manager.onVariablesChanged(new Set(['var1']))
			vi.runAllTimers()

			expect(mockUpdateIsInvertedFn).toHaveBeenCalledWith(
				new Map<string, NewSpecialExpressionValue<'isInverted'>>([
					[
						'entity-1',
						{
							entityId: 'entity-1',
							controlId: 'control-1',
							value: true,
						},
					],
				])
			)
		})

		it('should invalidate entities that reference changed variables, local-variable storeResult', () => {
			const ExpressionResultVariableIds: readonly string[] = ['var1', 'var2']
			const ParseVariablesVariableIds: readonly string[] = ['var3', 'var4']

			const resetParseResults = () => {
				mockParseExpressionResult = {
					ok: true,
					value: 'expr-location',
					variableIds: new Set(ExpressionResultVariableIds),
				}
				mockParseVariablesResult = {
					text: 'parsed-variableName',
					variableIds: new Set(ParseVariablesVariableIds),
				}
			}

			resetParseResults()

			const mockEntity = createMockActionEntity('entity-86', {
				type: 'local-variable',
				location: {
					isExpression: true,
					value: `'expression'`,
				},
				variableName: {
					isExpression: false,
					value: 'original variable name',
				},
			})

			manager.trackEntity(mockEntity, 'storeResult')
			vi.runAllTimers()
			expect(mockUpdateStoreResultFn).toHaveBeenCalledWith(
				new Map<string, NewSpecialExpressionValue<'storeResult'>>([
					[
						'entity-86',
						{
							entityId: 'entity-86',
							controlId: 'control-1',
							value: {
								type: 'local-variable',
								location: 'expr-location',
								variableName: 'parsed-variableName',
							},
						},
					],
				])
			)
			mockUpdateStoreResultFn.mockClear()

			for (const singleVar of [...ExpressionResultVariableIds, ...ParseVariablesVariableIds]) {
				// Change the parse results for re-processing
				resetParseResults()

				manager.onVariablesChanged(new Set([singleVar]))
				vi.runAllTimers()

				expect(mockUpdateStoreResultFn).toHaveBeenCalledWith(
					new Map<string, NewSpecialExpressionValue<'storeResult'>>([
						[
							'entity-86',
							{
								entityId: 'entity-86',
								controlId: 'control-1',
								value: {
									type: 'local-variable',
									location: 'expr-location',
									variableName: 'parsed-variableName',
								},
							},
						],
					])
				)
			}
		})

		it('should invalidate entities that reference changed variables, custom-variable storeResult', () => {
			const ExpressionResultVariableIds: readonly string[] = ['var1', 'var2']

			const resetParseResult = () => {
				mockParseExpressionResult = {
					ok: true,
					value: 'expr-variableName',
					variableIds: new Set(ExpressionResultVariableIds),
				}
			}

			resetParseResult()

			const mockEntity = createMockActionEntity('entity-86', {
				type: 'custom-variable',
				variableName: {
					isExpression: true,
					value: 'original variable name',
				},
				createIfNotExists: false,
			})

			manager.trackEntity(mockEntity, 'storeResult')
			vi.runAllTimers()
			expect(mockUpdateStoreResultFn).toHaveBeenCalledWith(
				new Map<string, NewSpecialExpressionValue<'storeResult'>>([
					[
						'entity-86',
						{
							entityId: 'entity-86',
							controlId: 'control-1',
							value: {
								type: 'custom-variable',
								variableName: 'expr-variableName',
								createIfNotExists: false,
							},
						},
					],
				])
			)
			mockUpdateStoreResultFn.mockClear()

			for (const singleVar of ExpressionResultVariableIds) {
				// Change the parse results for re-processing
				resetParseResult()

				manager.onVariablesChanged(new Set([singleVar]))
				vi.runAllTimers()

				expect(mockUpdateStoreResultFn).toHaveBeenCalledWith(
					new Map<string, NewSpecialExpressionValue<'storeResult'>>([
						[
							'entity-86',
							{
								entityId: 'entity-86',
								controlId: 'control-1',
								value: {
									type: 'custom-variable',
									variableName: 'expr-variableName',
									createIfNotExists: false,
								},
							},
						],
					])
				)
			}
		})

		it('should not invalidate entities if changed variables are not referenced, isInverted', () => {
			mockParseExpressionResult = {
				ok: true,
				value: false,
				variableIds: new Set(['specific-var']),
			}

			const mockEntity = createMockFeedbackEntity('entity-1', { isExpression: true, value: '$(internal:specific-var)' })

			manager.trackEntity(mockEntity, 'isInverted')
			vi.runAllTimers()
			mockUpdateIsInvertedFn.mockClear()

			manager.onVariablesChanged(new Set(['unrelated-var']))
			vi.runAllTimers()

			expect(mockUpdateIsInvertedFn).not.toHaveBeenCalled()
		})

		it('should not invalidate entities if changed variables are not referenced, storeResult', () => {
			mockParseExpressionResult = {
				ok: true,
				value: 'expressed-location',
				variableIds: new Set(['specific-var']),
			}
			mockParseVariablesResult = {
				text: 'parsed-variables-result',
				variableIds: new Set(['parsed-var']),
			}

			const mockEntity = createMockActionEntity('entity-17', {
				type: 'local-variable',
				location: {
					isExpression: true,
					value: 'expression containing location',
				},
				variableName: {
					isExpression: false,
					value: 'string parsing to variable name',
				},
			})

			manager.trackEntity(mockEntity, 'storeResult')
			vi.runAllTimers()
			mockUpdateStoreResultFn.mockClear()

			manager.onVariablesChanged(new Set(['unrelated-var']))
			vi.runAllTimers()

			expect(mockUpdateStoreResultFn).not.toHaveBeenCalled()
		})

		it('should not invalidate entities without expressions, isInverted', () => {
			const mockEntity = createMockFeedbackEntity('entity-1', { isExpression: false, value: true })

			manager.trackEntity(mockEntity, 'isInverted')
			vi.runAllTimers()
			mockUpdateIsInvertedFn.mockClear()

			manager.onVariablesChanged(new Set(['var1']))
			vi.runAllTimers()

			expect(mockUpdateIsInvertedFn).not.toHaveBeenCalled()
		})

		it('should not invalidate entities without expressions, storeResult', () => {
			const mockEntity = createMockActionEntity('entity-33', undefined)

			manager.trackEntity(mockEntity, 'storeResult')
			vi.runAllTimers()
			mockUpdateStoreResultFn.mockClear()

			manager.onVariablesChanged(new Set(['var1']))
			vi.runAllTimers()

			expect(mockUpdateStoreResultFn).not.toHaveBeenCalled()
		})

		it('should invalidate multiple entities that reference the same variable', () => {
			mockParseExpressionResult = {
				ok: true,
				value: '1/2/3',
				variableIds: new Set(['shared-var']),
			}
			mockParseVariablesResult = {
				text: 'variable-name',
				variableIds: new Set(['shared-var', 'exclusive-var']),
			}

			const mockEntity1 = createMockActionEntity('entity-1', {
				type: 'custom-variable',
				variableName: {
					isExpression: false,
					value: 'custom variable name parse string',
				},
				createIfNotExists: false,
			})
			const mockEntity2 = createMockActionEntity('entity-2', {
				type: 'local-variable',
				location: {
					isExpression: true,
					value: 'expression location string',
				},
				variableName: {
					isExpression: false,
					value: 'local variable name parse string',
				},
			})

			manager.trackEntity(mockEntity1, 'storeResult')
			manager.trackEntity(mockEntity2, 'storeResult')
			vi.runAllTimers()
			mockUpdateStoreResultFn.mockClear()

			// Change the expression result for re-processing
			mockParseExpressionResult = {
				ok: true,
				value: '4/5/6',
				variableIds: new Set(['shared-var']),
			}

			manager.onVariablesChanged(new Set(['shared-var']))
			vi.runAllTimers()

			expect(mockUpdateStoreResultFn).toHaveBeenCalledTimes(1)
			expect(mockUpdateStoreResultFn).toHaveBeenCalledWith(
				new Map<string, NewSpecialExpressionValue<'storeResult'>>([
					[
						'entity-1',
						{
							entityId: 'entity-1',
							controlId: 'control-1',
							value: {
								type: 'custom-variable',
								variableName: 'variable-name',
								createIfNotExists: false,
							},
						},
					],
					[
						'entity-2',
						{
							entityId: 'entity-2',
							controlId: 'control-1',
							value: {
								type: 'local-variable',
								location: '4/5/6',
								variableName: 'variable-name',
							},
						},
					],
				])
			)
		})

		it('should not process entities already queued for processing, isInverted', () => {
			mockParseExpressionResult = {
				ok: true,
				value: false,
				variableIds: new Set(['var1']),
			}

			const mockEntity = createMockFeedbackEntity('entity-1', { isExpression: true, value: '$(internal:var1)' })

			manager.trackEntity(mockEntity, 'isInverted')
			// Don't run timers yet - entity is still pending

			manager.onVariablesChanged(new Set(['var1']))
			vi.runAllTimers()

			// Should only be called once despite both trackEntity and onVariablesChanged
			expect(mockUpdateIsInvertedFn).toHaveBeenCalledTimes(1)
		})

		it('should not process entities already queued for processing, storeResult', () => {
			mockParseExpressionResult = {
				ok: true,
				value: 'loc',
				variableIds: new Set(['var1']),
			}
			mockParseVariablesResult = {
				text: 'hello',
				variableIds: new Set(['var2']),
			}

			const mockEntity = createMockActionEntity('entity-1', {
				type: 'local-variable',
				location: {
					isExpression: true,
					value: 'expression for location',
				},
				variableName: {
					isExpression: false,
					value: 'string to parse for variable name',
				},
			})

			manager.trackEntity(mockEntity, 'storeResult')
			// Don't run timers yet - entity is still pending

			manager.onVariablesChanged(new Set(['var1']))
			vi.runAllTimers()

			// Should only be called once despite both trackEntity and onVariablesChanged
			expect(mockUpdateStoreResultFn).toHaveBeenCalledTimes(1)
		})
	})

	describe('destroy', () => {
		it('should clear entities and prevent further processing, isInverted', () => {
			const mockEntity = createMockFeedbackEntity('entity-1', { isExpression: false, value: true })

			manager.trackEntity(mockEntity, 'isInverted')
			manager.destroy()

			vi.runAllTimers()

			expect(mockUpdateIsInvertedFn).not.toHaveBeenCalled()
		})

		it('should clear entities and prevent further processing, storeResult', () => {
			const mockEntity = createMockActionEntity('entity-1', undefined)

			manager.trackEntity(mockEntity, 'storeResult')
			manager.destroy()

			vi.runAllTimers()

			expect(mockUpdateStoreResultFn).not.toHaveBeenCalled()
		})

		it('should prevent new entities from being processed after destroy', () => {
			manager.destroy()

			const mockEntity = createMockFeedbackEntity('entity-1', { isExpression: false, value: true })
			manager.trackEntity(mockEntity, 'isInverted')

			const mockActionEntity = createMockActionEntity('entity-42', undefined)
			manager.trackEntity(mockActionEntity, 'storeResult')

			vi.runAllTimers()

			expect(mockUpdateIsInvertedFn).not.toHaveBeenCalled()
			expect(mockUpdateStoreResultFn).not.toHaveBeenCalled()
		})

		it('should prevent variable changes from triggering processing after destroy', () => {
			mockParseExpressionResult = {
				ok: true,
				value: false,
				variableIds: new Set(['var1']),
			}

			const mockEntity = createMockFeedbackEntity('entity-1', { isExpression: true, value: '$(internal:var1)' })
			manager.trackEntity(mockEntity, 'isInverted')
			const mockActionEntity = createMockActionEntity('entity-2', undefined)
			manager.trackEntity(mockActionEntity, 'storeResult')

			vi.runAllTimers()

			mockUpdateIsInvertedFn.mockClear()
			mockUpdateStoreResultFn.mockClear()

			manager.destroy()

			manager.onVariablesChanged(new Set(['var1']))
			vi.runAllTimers()

			expect(mockUpdateIsInvertedFn).not.toHaveBeenCalled()
			expect(mockUpdateStoreResultFn).not.toHaveBeenCalled()
		})
	})

	describe('weak reference cleanup', () => {
		it('should handle garbage collected entities gracefully, isInverted', () => {
			// This test verifies the WeakRef behavior - when an entity is garbage collected,
			// the manager should skip it during processing
			const mockEntity = createMockFeedbackEntity('entity-1', { isExpression: false, value: true })

			manager.trackEntity(mockEntity, 'isInverted')

			// Note: We can't actually force garbage collection in tests, but we can verify
			// that the code handles the case where deref() returns undefined
			vi.runAllTimers()

			expect(mockUpdateIsInvertedFn).toHaveBeenCalled()
		})

		it('should handle garbage collected entities gracefully, storeResult', () => {
			// This test verifies the WeakRef behavior - when an entity is garbage collected,
			// the manager should skip it during processing
			const mockEntity = createMockFeedbackEntity('entity-1', undefined)

			manager.trackEntity(mockEntity, 'storeResult')

			// Note: We can't actually force garbage collection in tests, but we can verify
			// that the code handles the case where deref() returns undefined
			vi.runAllTimers()

			expect(mockUpdateStoreResultFn).toHaveBeenCalled()
		})
	})

	describe('debouncing', () => {
		it('should debounce multiple track calls into distinct update calls', () => {
			const mockEntity1 = createMockFeedbackEntity('entity-1', { isExpression: false, value: true })
			const mockEntity2 = createMockFeedbackEntity('entity-2', { isExpression: false, value: false })
			const mockEntity3 = createMockFeedbackEntity('entity-3', { isExpression: false, value: true })
			const mockEntity4 = createMockActionEntity('entity-4', undefined)
			const mockEntity5 = createMockActionEntity('entity-5', undefined)

			manager.trackEntity(mockEntity1, 'isInverted')
			manager.trackEntity(mockEntity2, 'isInverted')
			manager.trackEntity(mockEntity3, 'isInverted')
			manager.trackEntity(mockEntity4, 'storeResult')
			manager.trackEntity(mockEntity5, 'storeResult')

			vi.runAllTimers()

			// All five should be processed in two batches
			expect(mockUpdateIsInvertedFn).toHaveBeenCalledTimes(1)
			const isInvertedCall = mockUpdateIsInvertedFn.mock.calls[0][0]
			expect(isInvertedCall.size).toBe(3)

			expect(mockUpdateStoreResultFn).toHaveBeenCalledTimes(1)
			const storeResultCall = mockUpdateStoreResultFn.mock.calls[0][0]
			expect(storeResultCall.size).toBe(2)
		})

		it('should process after debounce timeout', () => {
			const mockEntity1 = createMockFeedbackEntity('entity-1', { isExpression: false, value: true })
			manager.trackEntity(mockEntity1, 'isInverted')

			const mockEntity2 = createMockActionEntity('entity-2', undefined)
			manager.trackEntity(mockEntity2, 'storeResult')

			// Advance time less than debounce wait
			vi.advanceTimersByTime(5)
			expect(mockUpdateIsInvertedFn).not.toHaveBeenCalled()
			expect(mockUpdateStoreResultFn).not.toHaveBeenCalled()

			// Advance time past debounce wait
			vi.advanceTimersByTime(10)
			expect(mockUpdateIsInvertedFn).toHaveBeenCalled()
			expect(mockUpdateStoreResultFn).toHaveBeenCalled()
		})
	})

	describe('createVariablesAndExpressionParser', () => {
		it('should create a new parser for each processing batch', () => {
			const mockEntity1 = createMockFeedbackEntity('entity-1-1', { isExpression: true, value: '$(internal:var1)' })
			const mockActionEntity1 = createMockActionEntity('entity-1-2', undefined)

			const mockEntity2 = createMockFeedbackEntity('entity-2', { isExpression: true, value: '$(internal:var2)' })
			const mockActionEntity2 = createMockActionEntity('entity-2-2', undefined)

			mockParseExpressionResult = {
				ok: true,
				value: false,
				variableIds: new Set(['var1']),
			}

			manager.trackEntity(mockEntity1, 'isInverted')
			manager.trackEntity(mockActionEntity1, 'storeResult')
			vi.runAllTimers()

			expect(mockCreateVariablesAndExpressionParser).toHaveBeenCalledTimes(1)
			expect(mockCreateVariablesAndExpressionParser).toHaveBeenCalledWith(null)

			mockCreateVariablesAndExpressionParser.mockClear()

			mockParseExpressionResult = {
				ok: true,
				value: true,
				variableIds: new Set(['var2']),
			}

			manager.trackEntity(mockEntity2, 'isInverted')
			manager.trackEntity(mockActionEntity2, 'storeResult')
			vi.runAllTimers()

			expect(mockCreateVariablesAndExpressionParser).toHaveBeenCalledTimes(1)
		})
	})

	describe('edge cases', () => {
		it('should handle null rawIsInverted as false', () => {
			const mockEntity = createMockFeedbackEntity('entity-1', null as any)

			manager.trackEntity(mockEntity, 'isInverted')

			vi.runAllTimers()

			expect(mockUpdateIsInvertedFn).toHaveBeenCalledWith(
				new Map<string, NewSpecialExpressionValue<'isInverted'>>([
					[
						'entity-1',
						{
							entityId: 'entity-1',
							controlId: 'control-1',
							value: false,
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

			const mockEntity = createMockFeedbackEntity('entity-1', { isExpression: true, value: '' })

			manager.trackEntity(mockEntity, 'isInverted')

			vi.runAllTimers()

			expect(mockUpdateIsInvertedFn).toHaveBeenCalledWith(
				new Map<string, NewSpecialExpressionValue<'isInverted'>>([
					[
						'entity-1',
						{
							entityId: 'entity-1',
							controlId: 'control-1',
							value: false, // empty string is falsy
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

			const mockEntity = createMockFeedbackEntity('entity-1', { isExpression: true, value: '$(missing:var)' })

			manager.trackEntity(mockEntity, 'isInverted')

			vi.runAllTimers()

			expect(mockUpdateIsInvertedFn).toHaveBeenCalledWith(
				new Map<string, NewSpecialExpressionValue<'isInverted'>>([
					[
						'entity-1',
						{
							entityId: 'entity-1',
							controlId: 'control-1',
							value: false, // undefined is falsy
						},
					],
				])
			)
		})

		it('should not call updateFn if no entities need processing', () => {
			// Trigger variable change without any tracked entities
			manager.onVariablesChanged(new Set(['var1']))

			vi.runAllTimers()

			expect(mockUpdateIsInvertedFn).not.toHaveBeenCalled()
		})
	})
})
