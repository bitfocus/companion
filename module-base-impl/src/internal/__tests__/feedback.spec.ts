/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
	FeedbackInstance,
	ParseVariablesInStringResponseMessage,
	ParseVariablesInStringMessage,
	SetFeedbackDefinitionsMessage,
	UpdateFeedbackValuesMessage,
} from '../../host-api/api'
import { runAllTimers } from '../../__mocks__/util'
import { FeedbackManager } from '../feedback'
import { CompanionFeedbackDefinition, LogLevel } from '../../module-api'
import { literal } from '../../util'

const mockDefinitionId = 'definition0'
const mockDefinitionId2 = 'definition1'
const feedbackId = 'abcdef'
const feedback: FeedbackInstance = {
	id: feedbackId,
	upgradeIndex: null,
	disabled: false,

	feedbackId: mockDefinitionId,
	options: { a: 1, b: 4 },

	controlId: 'control0',
	image: undefined,
	page: 0,
	bank: 0,
	rawBank: 'test' as any,
}

const feedbackId2 = 'abc123'
const feedback2: FeedbackInstance = {
	id: feedbackId2,
	upgradeIndex: null,
	disabled: false,

	feedbackId: mockDefinitionId2,
	options: { a: 1, b: 4 },

	controlId: 'control1',
	image: undefined,
	page: 0,
	bank: 0,
	rawBank: 'test' as any,
}

const unimplementedAsyncFunction = async () => {
	throw new Error('Not implemented')
}
const unimplementedFunction = () => {
	throw new Error('Not implemented')
}

const mockLogger = (level: LogLevel, msg: string) => {
	console.log(`${level}: ${msg}`)
}

describe('FeedbackManager', () => {
	beforeEach(() => {
		jest.useFakeTimers()

		jest.clearAllMocks()
	})

	it('set definitions', () => {
		const mockSetFeedbackDefinitions = jest.fn((_msg: SetFeedbackDefinitionsMessage) => null)
		const manager = new FeedbackManager(
			unimplementedAsyncFunction,
			unimplementedFunction,
			mockSetFeedbackDefinitions,
			mockLogger
		)
		expect(manager.getDefinitionIds()).toHaveLength(0)
		expect(manager.getInstanceIds()).toHaveLength(0)

		const mockDefinition: CompanionFeedbackDefinition = {
			type: 'boolean',
			name: 'Definition0',
			defaultStyle: {},
			options: [],
			callback: jest.fn(() => false),
		}

		manager.setFeedbackDefinitions({ [mockDefinitionId]: mockDefinition })

		expect(manager.getDefinitionIds()).toEqual([mockDefinitionId])
		expect(mockSetFeedbackDefinitions).toHaveBeenCalledTimes(1)
		expect(mockSetFeedbackDefinitions).lastCalledWith({
			feedbacks: [
				{
					id: mockDefinitionId,
					type: 'boolean',
					name: 'Definition0',
					description: undefined,
					hasLearn: false,
					defaultStyle: {},
					options: [],
				},
			],
		})

		// replace existing
		const mockDefinitionId2 = 'definition0'
		manager.setFeedbackDefinitions({ [mockDefinitionId2]: mockDefinition })

		expect(manager.getDefinitionIds()).toEqual([mockDefinitionId2])
		expect(manager.getInstanceIds()).toHaveLength(0)
		expect(mockSetFeedbackDefinitions).toHaveBeenCalledTimes(2)
	})

	it('execute callback on registration', async () => {
		const mockUpdateFeedbackValues = jest.fn((_msg: UpdateFeedbackValuesMessage) => null)
		const mockSetFeedbackDefinitions = jest.fn((_msg: SetFeedbackDefinitionsMessage) => null)
		const manager = new FeedbackManager(
			unimplementedAsyncFunction,
			mockUpdateFeedbackValues,
			mockSetFeedbackDefinitions,
			mockLogger
		)
		expect(manager.getDefinitionIds()).toHaveLength(0)
		expect(manager.getInstanceIds()).toHaveLength(0)

		const mockDefinitionId = 'definition0'
		const mockDefinition: CompanionFeedbackDefinition = {
			type: 'boolean',
			name: 'Definition0',
			defaultStyle: {},
			options: [],
			callback: jest.fn(() => false),
		}

		// setup definition
		manager.setFeedbackDefinitions({ [mockDefinitionId]: mockDefinition })
		expect(manager.getDefinitionIds()).toEqual([mockDefinitionId])
		expect(manager.getInstanceIds()).toHaveLength(0)
		expect(mockSetFeedbackDefinitions).toHaveBeenCalledTimes(1)

		expect(mockDefinition.callback).toHaveBeenCalledTimes(0)

		// report a feedback
		manager.handleUpdateFeedbacks({
			[feedbackId]: feedback,
		})

		// not called immediately
		expect(mockDefinition.callback).toHaveBeenCalledTimes(0)

		// wait for debounce
		await runAllTimers()
		expect(mockDefinition.callback).toHaveBeenCalledTimes(1)
		// make sure it looks like expected
		expect(mockDefinition.callback).toHaveBeenLastCalledWith(
			{
				id: feedbackId,
				type: mockDefinition.type,
				feedbackId: feedback.feedbackId,
				controlId: feedback.controlId,
				options: feedback.options,
				_rawBank: feedback.rawBank,
			},
			expect.anything()
		)
		expect(manager.getInstanceIds()).toEqual([feedbackId])

		expect(mockUpdateFeedbackValues).toHaveBeenCalledTimes(1)
		expect(mockUpdateFeedbackValues).toHaveBeenLastCalledWith({
			values: [
				{
					id: 'abcdef',
					controlId: 'control0',
					value: false,
				},
			],
		})
	})

	it('instance: disabled', async () => {
		const mockSetFeedbackDefinitions = jest.fn((_msg: SetFeedbackDefinitionsMessage) => null)
		const manager = new FeedbackManager(
			unimplementedAsyncFunction,
			unimplementedFunction,
			mockSetFeedbackDefinitions,
			mockLogger
		)
		expect(manager.getDefinitionIds()).toHaveLength(0)
		expect(manager.getInstanceIds()).toHaveLength(0)

		const mockDefinitionId = 'definition0'
		const mockDefinition: CompanionFeedbackDefinition = {
			type: 'boolean',
			name: 'Definition0',
			defaultStyle: {},
			options: [],
			callback: jest.fn(() => false),
		}

		// setup definition
		manager.setFeedbackDefinitions({ [mockDefinitionId]: mockDefinition })
		expect(manager.getDefinitionIds()).toEqual([mockDefinitionId])
		expect(manager.getInstanceIds()).toHaveLength(0)
		expect(mockSetFeedbackDefinitions).toHaveBeenCalledTimes(1)

		expect(mockDefinition.callback).toHaveBeenCalledTimes(0)

		// report a feedback
		manager.handleUpdateFeedbacks({
			[feedbackId]: {
				...feedback,
				disabled: true,
			},
		})

		// wait for debounce
		await runAllTimers()
		expect(mockDefinition.callback).toHaveBeenCalledTimes(0)
		expect(manager.getInstanceIds()).toHaveLength(0)
	})

	it('instance: delete', async () => {
		const mockUpdateFeedbackValues = jest.fn((_msg: UpdateFeedbackValuesMessage) => null)
		const mockSetFeedbackDefinitions = jest.fn((_msg: SetFeedbackDefinitionsMessage) => null)
		const manager = new FeedbackManager(
			unimplementedAsyncFunction,
			mockUpdateFeedbackValues,
			mockSetFeedbackDefinitions,
			mockLogger
		)
		expect(manager.getDefinitionIds()).toHaveLength(0)
		expect(manager.getInstanceIds()).toHaveLength(0)

		const mockDefinition: CompanionFeedbackDefinition = {
			type: 'boolean',
			name: 'Definition0',
			defaultStyle: {},
			options: [],
			callback: jest.fn(() => false),
		}

		// setup definition
		manager.setFeedbackDefinitions({ [mockDefinitionId]: mockDefinition })
		expect(manager.getDefinitionIds()).toEqual([mockDefinitionId])
		expect(manager.getInstanceIds()).toHaveLength(0)
		expect(mockSetFeedbackDefinitions).toHaveBeenCalledTimes(1)

		expect(mockDefinition.callback).toHaveBeenCalledTimes(0)

		// report a feedback
		manager.handleUpdateFeedbacks({
			[feedbackId]: feedback,
			[feedbackId2]: {
				...feedback2,
				feedbackId: mockDefinitionId,
			},
		})

		// wait for debounce
		await runAllTimers()
		expect(mockDefinition.callback).toHaveBeenCalledTimes(2)
		expect(manager.getInstanceIds()).toEqual([feedbackId, feedbackId2])

		// remove a feedback
		manager.handleUpdateFeedbacks({
			[feedbackId]: undefined,
		})

		// wait for debounce
		await runAllTimers()
		expect(mockDefinition.callback).toHaveBeenCalledTimes(2)
		expect(manager.getInstanceIds()).toEqual([feedbackId2])
	})

	describe('checkFeedbacks', () => {
		const mockSetFeedbackDefinitions = jest.fn((_msg: SetFeedbackDefinitionsMessage) => null)
		const mockUpdateFeedbackValues = jest.fn((_msg: UpdateFeedbackValuesMessage) => null)
		const manager = new FeedbackManager(
			unimplementedAsyncFunction,
			mockUpdateFeedbackValues,
			mockSetFeedbackDefinitions,
			mockLogger
		)

		const mockDefinition: CompanionFeedbackDefinition = {
			type: 'boolean',
			name: 'Definition0',
			defaultStyle: {},
			options: [],
			callback: jest.fn(() => false),
		}
		const mockDefinition2: CompanionFeedbackDefinition = {
			type: 'advanced',
			name: 'Definition2',
			options: [],
			callback: jest.fn(() => ({})),
		}

		beforeAll(async () => {
			expect(manager.getDefinitionIds()).toHaveLength(0)
			expect(manager.getInstanceIds()).toHaveLength(0)

			// setup definition
			manager.setFeedbackDefinitions({
				[mockDefinitionId]: mockDefinition,
				[mockDefinitionId2]: mockDefinition2,
			})
			expect(manager.getDefinitionIds()).toEqual([mockDefinitionId, mockDefinitionId2])
			expect(mockSetFeedbackDefinitions).toHaveBeenCalledTimes(1)

			expect(mockDefinition.callback).toHaveBeenCalledTimes(0)

			// report a feedback
			manager.handleUpdateFeedbacks({
				[feedbackId]: feedback,
				[feedbackId2]: feedback2,
			})
			await runAllTimers()
			expect(mockDefinition.callback).toHaveBeenCalledTimes(1)
			expect(mockDefinition2.callback).toHaveBeenCalledTimes(1)

			expect(manager.getInstanceIds()).toEqual([feedbackId, feedbackId2])
		})

		beforeEach(() => {
			jest.clearAllMocks()
		})

		it('no types specified', async () => {
			// make sure it didnt want to rerun by itself
			await runAllTimers()
			expect(mockDefinition.callback).toHaveBeenCalledTimes(0)
			expect(mockDefinition2.callback).toHaveBeenCalledTimes(0)

			// check all
			manager.checkFeedbacks([])

			await runAllTimers()
			expect(mockDefinition.callback).toHaveBeenCalledTimes(1)
			expect(mockDefinition2.callback).toHaveBeenCalledTimes(1)

			expect(mockUpdateFeedbackValues).toHaveBeenCalledTimes(1)
			expect(mockUpdateFeedbackValues).toHaveBeenLastCalledWith({
				values: [
					{
						id: 'abcdef',
						controlId: 'control0',
						value: false,
					},
					{
						id: 'abc123',
						controlId: 'control1',
						value: {},
					},
				],
			})
		})

		it('for type', async () => {
			// make sure it didnt want to rerun by itself
			await runAllTimers()
			expect(mockDefinition.callback).toHaveBeenCalledTimes(0)
			expect(mockDefinition2.callback).toHaveBeenCalledTimes(0)

			// check all
			manager.checkFeedbacks([mockDefinitionId2, 'fake-id'])

			await runAllTimers()
			expect(mockDefinition.callback).toHaveBeenCalledTimes(0)
			expect(mockDefinition2.callback).toHaveBeenCalledTimes(1)

			expect(mockUpdateFeedbackValues).toHaveBeenCalledTimes(1)
			expect(mockUpdateFeedbackValues).toHaveBeenLastCalledWith({
				values: [
					{
						id: 'abc123',
						controlId: 'control1',
						value: {},
					},
				],
			})
		})

		it('for ids', async () => {
			// make sure it didnt want to rerun by itself
			await runAllTimers()
			expect(mockDefinition.callback).toHaveBeenCalledTimes(0)
			expect(mockDefinition2.callback).toHaveBeenCalledTimes(0)

			// check all
			manager.checkFeedbacksById([feedbackId, 'fake-id'])

			await runAllTimers()
			expect(mockDefinition.callback).toHaveBeenCalledTimes(1)
			expect(mockDefinition2.callback).toHaveBeenCalledTimes(0)

			expect(mockUpdateFeedbackValues).toHaveBeenCalledTimes(1)
			expect(mockUpdateFeedbackValues).toHaveBeenLastCalledWith({
				values: [
					{
						id: 'abcdef',
						controlId: 'control0',
						value: false,
					},
				],
			})
		})

		it('on unrelated variables change', async () => {
			// make sure it didnt want to rerun by itself
			await runAllTimers()
			expect(mockDefinition.callback).toHaveBeenCalledTimes(0)
			expect(mockDefinition2.callback).toHaveBeenCalledTimes(0)

			// check all
			manager.handleVariablesChanged({
				variablesIds: ['not-used'],
			})

			await runAllTimers()
			expect(mockDefinition.callback).toHaveBeenCalledTimes(0)
			expect(mockDefinition2.callback).toHaveBeenCalledTimes(0)
		})
	})

	describe('variables change', () => {
		const mockParseVariables = jest.fn(async (msg: ParseVariablesInStringMessage) =>
			literal<ParseVariablesInStringResponseMessage>({
				text: `res - ${msg.text}`,
				variableIds: ['all', `var-${msg.text}`],
			})
		)
		const mockSetFeedbackDefinitions = jest.fn((_msg: SetFeedbackDefinitionsMessage) => null)
		const mockUpdateFeedbackValues = jest.fn((_msg: UpdateFeedbackValuesMessage) => null)
		const manager = new FeedbackManager(
			mockParseVariables,
			mockUpdateFeedbackValues,
			mockSetFeedbackDefinitions,
			mockLogger
		)

		const mockDefinition: CompanionFeedbackDefinition = {
			type: 'boolean',
			name: 'Definition0',
			defaultStyle: {},
			options: [],
			callback: jest.fn(async (fb, ctx) => {
				await ctx.parseVariablesInString(fb.id)
				return false
			}),
		}
		const mockDefinition2: CompanionFeedbackDefinition = {
			type: 'advanced',
			name: 'Definition2',
			options: [],
			callback: jest.fn(async (fb, ctx) => {
				await ctx.parseVariablesInString(fb.id)
				return {}
			}),
		}

		beforeAll(async () => {
			expect(manager.getDefinitionIds()).toHaveLength(0)
			expect(manager.getInstanceIds()).toHaveLength(0)

			// setup definition
			manager.setFeedbackDefinitions({
				[mockDefinitionId]: mockDefinition,
				[mockDefinitionId2]: mockDefinition2,
			})
			expect(manager.getDefinitionIds()).toEqual([mockDefinitionId, mockDefinitionId2])
			expect(mockSetFeedbackDefinitions).toHaveBeenCalledTimes(1)

			expect(mockDefinition.callback).toHaveBeenCalledTimes(0)

			// report a feedback
			manager.handleUpdateFeedbacks({
				[feedbackId]: feedback,
				[feedbackId2]: feedback2,
			})
			await runAllTimers()
			expect(mockDefinition.callback).toHaveBeenCalledTimes(1)
			expect(mockDefinition2.callback).toHaveBeenCalledTimes(1)

			expect(manager.getInstanceIds()).toEqual([feedbackId, feedbackId2])

			expect(mockParseVariables).toHaveBeenCalledTimes(2)
			expect(mockParseVariables).toHaveBeenCalledWith({
				text: 'abc123',
				controlId: 'control1',
				actionInstanceId: undefined,
				feedbackInstanceId: 'abc123',
			})
			expect(mockParseVariables).toHaveBeenCalledWith({
				text: 'abcdef',
				controlId: 'control0',
				actionInstanceId: undefined,
				feedbackInstanceId: 'abcdef',
			})
		})

		beforeEach(() => {
			jest.clearAllMocks()
		})

		it('on unrelated variables change', async () => {
			// make sure it didnt want to rerun by itself
			await runAllTimers()
			expect(mockDefinition.callback).toHaveBeenCalledTimes(0)
			expect(mockDefinition2.callback).toHaveBeenCalledTimes(0)

			// check all
			manager.handleVariablesChanged({
				variablesIds: ['var-unused'],
			})

			await runAllTimers()
			expect(mockDefinition.callback).toHaveBeenCalledTimes(0)
			expect(mockDefinition2.callback).toHaveBeenCalledTimes(0)
		})

		it('on variable change', async () => {
			// make sure it didnt want to rerun by itself
			await runAllTimers()
			expect(mockDefinition.callback).toHaveBeenCalledTimes(0)
			expect(mockDefinition2.callback).toHaveBeenCalledTimes(0)

			// check all
			manager.handleVariablesChanged({
				variablesIds: ['var-abcdef'],
			})

			await runAllTimers()
			expect(mockDefinition.callback).toHaveBeenCalledTimes(1)
			expect(mockDefinition2.callback).toHaveBeenCalledTimes(0)

			// check it reparsed the variables
			expect(mockParseVariables).toBeCalledTimes(1)
			expect(mockParseVariables).toHaveBeenLastCalledWith({
				text: 'abcdef',
				controlId: 'control0',
				actionInstanceId: undefined,
				feedbackInstanceId: 'abcdef',
			})
		})

		it('on variable change for all', async () => {
			// make sure it didnt want to rerun by itself
			await runAllTimers()
			expect(mockDefinition.callback).toHaveBeenCalledTimes(0)
			expect(mockDefinition2.callback).toHaveBeenCalledTimes(0)

			// check all
			manager.handleVariablesChanged({
				variablesIds: ['all'],
			})

			await runAllTimers()
			expect(mockDefinition.callback).toHaveBeenCalledTimes(1)
			expect(mockDefinition2.callback).toHaveBeenCalledTimes(1)

			// check it reparsed the variables
			expect(mockParseVariables).toBeCalledTimes(2)
			expect(mockParseVariables).toHaveBeenCalledWith({
				text: 'abc123',
				controlId: 'control1',
				actionInstanceId: undefined,
				feedbackInstanceId: 'abc123',
			})
			expect(mockParseVariables).toHaveBeenCalledWith({
				text: 'abcdef',
				controlId: 'control0',
				actionInstanceId: undefined,
				feedbackInstanceId: 'abcdef',
			})
		})
	})

	describe('check while being checked', () => {
		const mockParseVariables = jest.fn(async (msg: ParseVariablesInStringMessage) =>
			literal<ParseVariablesInStringResponseMessage>({
				text: `res - ${msg.text}`,
				variableIds: ['all', `var-${msg.text}`],
			})
		)
		const mockSetFeedbackDefinitions = jest.fn((_msg: SetFeedbackDefinitionsMessage) => null)
		const mockUpdateFeedbackValues = jest.fn((_msg: UpdateFeedbackValuesMessage) => null)
		const manager = new FeedbackManager(
			mockParseVariables,
			mockUpdateFeedbackValues,
			mockSetFeedbackDefinitions,
			mockLogger
		)

		let waitForManualResolve = false
		let nextResolve: (() => void) | undefined

		const mockDefinition: CompanionFeedbackDefinition = {
			type: 'boolean',
			name: 'Definition0',
			defaultStyle: {},
			options: [],
			callback: jest.fn(async (fb, ctx) => {
				await ctx.parseVariablesInString(fb.id)

				if (waitForManualResolve) {
					expect(nextResolve).toBeUndefined()
					await new Promise<void>((resolve) => {
						nextResolve = resolve
					})
					nextResolve = undefined

					// await new Promise((resolve) => setImmediate(resolve))
				}

				return false
			}),
		}

		beforeAll(async () => {
			expect(manager.getDefinitionIds()).toHaveLength(0)
			expect(manager.getInstanceIds()).toHaveLength(0)

			// setup definition
			manager.setFeedbackDefinitions({ [mockDefinitionId]: mockDefinition })
			expect(manager.getDefinitionIds()).toEqual([mockDefinitionId])
			expect(mockSetFeedbackDefinitions).toHaveBeenCalledTimes(1)

			expect(mockDefinition.callback).toHaveBeenCalledTimes(0)

			// report a feedback
			manager.handleUpdateFeedbacks({ [feedbackId]: feedback })
			await runAllTimers()
			expect(mockDefinition.callback).toHaveBeenCalledTimes(1)

			expect(manager.getInstanceIds()).toEqual([feedbackId])

			expect(mockParseVariables).toHaveBeenCalledTimes(1)
		})

		beforeEach(() => {
			jest.clearAllMocks()

			waitForManualResolve = false
		})

		it('basic run', async () => {
			// make sure it didnt want to rerun by itself
			await runAllTimers()
			expect(mockDefinition.callback).toHaveBeenCalledTimes(0)

			// check all
			manager.checkFeedbacks([])

			await runAllTimers()
			expect(mockDefinition.callback).toHaveBeenCalledTimes(1)

			// check the value sent to the client
			expect(mockUpdateFeedbackValues).toHaveBeenCalledTimes(1)
			expect(mockUpdateFeedbackValues).toHaveBeenLastCalledWith({
				values: [
					{
						id: 'abcdef',
						controlId: 'control0',
						value: false,
					},
				],
			})
		})

		it('freeze feedback callback', async () => {
			// make sure it didnt want to rerun by itself
			await runAllTimers()
			expect(mockDefinition.callback).toHaveBeenCalledTimes(0)

			waitForManualResolve = true

			// check all
			manager.checkFeedbacks([])

			// make sure it hasnt completed yet
			await runAllTimers()
			expect(mockDefinition.callback).toHaveBeenCalledTimes(1)
			expect(nextResolve).toBeTruthy()
			expect(mockUpdateFeedbackValues).toHaveBeenCalledTimes(0)

			// let it complete now
			nextResolve!()
			await runAllTimers()
			expect(mockDefinition.callback).toHaveBeenCalledTimes(1)
			expect(nextResolve).toBeFalsy()

			// check the value sent to the client
			expect(mockUpdateFeedbackValues).toHaveBeenCalledTimes(1)
			expect(mockUpdateFeedbackValues).toHaveBeenLastCalledWith({
				values: [
					{
						id: 'abcdef',
						controlId: 'control0',
						value: false,
					},
				],
			})
		})

		it('update while frozen', async () => {
			// make sure it didnt want to rerun by itself
			await runAllTimers()
			expect(mockDefinition.callback).toHaveBeenCalledTimes(0)

			waitForManualResolve = true

			// check all
			manager.checkFeedbacks([])

			// make sure it hasnt completed yet
			await runAllTimers()
			expect(mockDefinition.callback).toHaveBeenCalledTimes(1)
			expect(nextResolve).toBeTruthy()
			expect(mockUpdateFeedbackValues).toHaveBeenCalledTimes(0)

			// trigger it to be checked again
			waitForManualResolve = false
			manager.checkFeedbacks([])

			// make sure the second doesnt start by itself
			await runAllTimers()
			expect(mockDefinition.callback).toHaveBeenCalledTimes(1)

			// let it complete now
			setImmediate(() => nextResolve!())
			await runAllTimers()
			await runAllTimers()

			// make sure it ran twice
			expect(mockDefinition.callback).toHaveBeenCalledTimes(2)
			expect(nextResolve).toBeFalsy()

			// check the value sent to the client
			expect(mockUpdateFeedbackValues).toHaveBeenCalledTimes(2)
		})

		it('variable changed while frozen', async () => {
			// make sure it didnt want to rerun by itself
			await runAllTimers()
			expect(mockDefinition.callback).toHaveBeenCalledTimes(0)

			waitForManualResolve = true

			// check all
			manager.handleVariablesChanged({
				variablesIds: ['all'],
			})

			// make sure it hasnt completed yet
			await runAllTimers()
			expect(mockDefinition.callback).toHaveBeenCalledTimes(1)
			expect(nextResolve).toBeTruthy()
			expect(mockUpdateFeedbackValues).toHaveBeenCalledTimes(0)

			// trigger it to be checked again
			waitForManualResolve = false
			manager.handleVariablesChanged({
				variablesIds: ['all'],
			})

			// make sure the second doesnt start by itself
			await runAllTimers()
			expect(mockDefinition.callback).toHaveBeenCalledTimes(1)

			// let it complete now
			setImmediate(() => nextResolve!())
			await runAllTimers()
			await runAllTimers()

			// make sure it ran twice
			expect(mockDefinition.callback).toHaveBeenCalledTimes(2)
			expect(nextResolve).toBeFalsy()

			// check the value sent to the client
			expect(mockUpdateFeedbackValues).toHaveBeenCalledTimes(2)
		})

		it('variables used by feedback change and those change while its running', async () => {
			// make sure it didnt want to rerun by itself
			await runAllTimers()
			expect(mockDefinition.callback).toHaveBeenCalledTimes(0)

			// make sure feedback doesnt recheck from this special var
			manager.handleVariablesChanged({
				variablesIds: ['different'],
			})
			await runAllTimers()
			expect(mockDefinition.callback).toHaveBeenCalledTimes(0)

			// change what variables will be found
			mockParseVariables.mockImplementationOnce(async (_msg: ParseVariablesInStringMessage) =>
				literal<ParseVariablesInStringResponseMessage>({
					text: `res - tmp`,
					variableIds: ['all', `different`],
				})
			)

			waitForManualResolve = true

			// check all
			manager.checkFeedbacks([])

			// make sure it hasnt completed yet
			await runAllTimers()
			expect(mockDefinition.callback).toHaveBeenCalledTimes(1)
			expect(nextResolve).toBeTruthy()
			expect(mockUpdateFeedbackValues).toHaveBeenCalledTimes(0)

			// trigger it to be checked again, with the newly dependent variable
			waitForManualResolve = false
			manager.handleVariablesChanged({
				variablesIds: ['different'],
			})

			// make sure the second doesnt start by itself
			await runAllTimers()
			expect(mockDefinition.callback).toHaveBeenCalledTimes(1)

			// let it complete now
			setImmediate(() => nextResolve!())
			await runAllTimers()
			await runAllTimers()

			// make sure it ran twice
			expect(mockDefinition.callback).toHaveBeenCalledTimes(2)
			expect(nextResolve).toBeFalsy()

			// check the value sent to the client
			expect(mockUpdateFeedbackValues).toHaveBeenCalledTimes(2)
		})
	})

	it('learn values: no implementation', async () => {
		const mockSetFeedbackDefinitions = jest.fn((_msg: SetFeedbackDefinitionsMessage) => null)
		const manager = new FeedbackManager(
			unimplementedAsyncFunction,
			unimplementedFunction,
			mockSetFeedbackDefinitions,
			mockLogger
		)
		expect(manager.getDefinitionIds()).toHaveLength(0)

		const mockDefinitionId = 'definition0'
		const mockDefinition: CompanionFeedbackDefinition = {
			type: 'boolean',
			name: 'Definition0',
			defaultStyle: {},
			options: [],
			callback: jest.fn(() => false),
		}

		// setup definition
		manager.setFeedbackDefinitions({ [mockDefinitionId]: mockDefinition })
		expect(manager.getDefinitionIds()).toEqual([mockDefinitionId])
		expect(mockSetFeedbackDefinitions).toHaveBeenCalledTimes(1)
		expect(mockDefinition.callback).toHaveBeenCalledTimes(0)

		// make the call
		await expect(manager.handleLearnFeedback({ feedback: feedback })).resolves.toEqual({ options: undefined })
	})

	it('learn values: with implementation', async () => {
		const mockSetFeedbackDefinitions = jest.fn((_msg: SetFeedbackDefinitionsMessage) => null)
		const manager = new FeedbackManager(
			unimplementedAsyncFunction,
			unimplementedFunction,
			mockSetFeedbackDefinitions,
			mockLogger
		)
		expect(manager.getDefinitionIds()).toHaveLength(0)

		const mockDefinitionId = 'definition0'
		const mockDefinition: CompanionFeedbackDefinition = {
			type: 'boolean',
			name: 'Definition0',
			defaultStyle: {},
			options: [],
			callback: jest.fn(() => false),
			learn: jest.fn(() => ({ abc: 123 })),
		}

		// setup definition
		manager.setFeedbackDefinitions({ [mockDefinitionId]: mockDefinition })
		expect(manager.getDefinitionIds()).toEqual([mockDefinitionId])
		expect(mockSetFeedbackDefinitions).toHaveBeenCalledTimes(1)
		expect(mockDefinition.callback).toHaveBeenCalledTimes(0)

		// make the call
		await expect(manager.handleLearnFeedback({ feedback: feedback })).resolves.toEqual({ options: { abc: 123 } })
		expect(mockDefinition.learn).toBeCalledTimes(1)
		expect(mockDefinition.learn).lastCalledWith(
			{
				id: feedbackId,
				type: mockDefinition.type,
				feedbackId: feedback.feedbackId,
				controlId: feedback.controlId,
				options: feedback.options,
			},
			expect.anything()
		)
	})

	it('learn values: with implementation using variables', async () => {
		const mockParseVariables = jest.fn(async (_msg: ParseVariablesInStringMessage) =>
			literal<ParseVariablesInStringResponseMessage>({
				text: 'res str',
				variableIds: ['abc', '123'],
			})
		)
		const mockSetFeedbackDefinitions = jest.fn((_msg: SetFeedbackDefinitionsMessage) => null)
		const manager = new FeedbackManager(
			mockParseVariables,
			unimplementedFunction,
			mockSetFeedbackDefinitions,
			mockLogger
		)
		expect(manager.getDefinitionIds()).toHaveLength(0)

		const mockDefinitionId = 'definition0'
		const mockDefinition: CompanionFeedbackDefinition = {
			type: 'boolean',
			name: 'Definition0',
			defaultStyle: {},
			options: [],
			callback: jest.fn(() => false),
			learn: jest.fn(async (fb, context) => {
				const val = await context.parseVariablesInString('test string')
				return { abc: val }
			}),
		}

		// setup definition
		manager.setFeedbackDefinitions({ [mockDefinitionId]: mockDefinition })
		expect(manager.getDefinitionIds()).toEqual([mockDefinitionId])
		expect(mockSetFeedbackDefinitions).toHaveBeenCalledTimes(1)
		expect(mockParseVariables).toHaveBeenCalledTimes(0)
		expect(mockDefinition.callback).toHaveBeenCalledTimes(0)

		// make the call
		await expect(manager.handleLearnFeedback({ feedback: feedback })).resolves.toEqual({
			options: { abc: 'res str' },
		})
		expect(mockParseVariables).toHaveBeenCalledTimes(1)
		expect(mockParseVariables).lastCalledWith({
			text: 'test string',
			controlId: 'control0',
			actionInstanceId: undefined,
			feedbackInstanceId: 'abcdef',
		})

		expect(mockDefinition.learn).toBeCalledTimes(1)
		expect(mockDefinition.learn).lastCalledWith(
			{
				id: feedbackId,
				type: mockDefinition.type,
				feedbackId: feedback.feedbackId,
				controlId: feedback.controlId,
				options: feedback.options,
			},
			expect.anything()
		)
	})

	describe('subscribe', () => {
		const mockSetFeedbackDefinitions = jest.fn((_msg: SetFeedbackDefinitionsMessage) => null)
		const mockUpdateFeedbackValues = jest.fn((_msg: UpdateFeedbackValuesMessage) => null)
		const manager = new FeedbackManager(
			unimplementedAsyncFunction,
			mockUpdateFeedbackValues,
			mockSetFeedbackDefinitions,
			mockLogger
		)

		const mockDefinition: CompanionFeedbackDefinition = {
			type: 'boolean',
			name: 'Definition0',
			defaultStyle: {},
			options: [],
			callback: jest.fn(async (_fb, _ctx) => false),
			subscribe: jest.fn(async (_fb, _ctx) => undefined),
		}

		beforeAll(async () => {
			expect(manager.getDefinitionIds()).toHaveLength(0)
			expect(manager.getInstanceIds()).toHaveLength(0)

			// setup definition
			manager.setFeedbackDefinitions({ [mockDefinitionId]: mockDefinition })
			expect(manager.getDefinitionIds()).toEqual([mockDefinitionId])
			expect(mockSetFeedbackDefinitions).toHaveBeenCalledTimes(1)

			expect(mockDefinition.callback).toHaveBeenCalledTimes(0)
		})

		beforeEach(async () => {
			manager.handleUpdateFeedbacks({
				[feedbackId]: undefined,
				[feedbackId2]: undefined,
			})

			jest.clearAllMocks()
		})

		it('called when adding', async () => {
			// report a feedback
			manager.handleUpdateFeedbacks({ [feedbackId]: feedback })

			await runAllTimers()
			expect(mockDefinition.subscribe).toHaveBeenCalledTimes(1)
			expect(mockDefinition.subscribe).toHaveBeenLastCalledWith(
				{
					id: feedbackId,
					type: mockDefinition.type,
					feedbackId: mockDefinitionId,
					controlId: feedback.controlId,
					options: feedback.options,
				},
				expect.anything()
			)

			expect(manager.getInstanceIds()).toEqual([feedbackId])
		})

		it('called when updated', async () => {
			// report a feedback
			manager.handleUpdateFeedbacks({ [feedbackId]: feedback })

			await runAllTimers()
			expect(mockDefinition.subscribe).toHaveBeenCalledTimes(1)

			// update it
			manager.handleUpdateFeedbacks({
				[feedbackId]: {
					...feedback,
					controlId: 'new-control',
					options: { val: 'changed' },
				},
			})

			await runAllTimers()
			expect(mockDefinition.subscribe).toHaveBeenCalledTimes(2)
			expect(mockDefinition.subscribe).toHaveBeenLastCalledWith(
				{
					id: feedbackId,
					type: mockDefinition.type,
					feedbackId: mockDefinitionId,
					controlId: 'new-control',
					options: { val: 'changed' },
				},
				expect.anything()
			)

			expect(manager.getInstanceIds()).toEqual([feedbackId])
		})

		it('not called when removed', async () => {
			// report a feedback
			manager.handleUpdateFeedbacks({ [feedbackId]: feedback })

			await runAllTimers()
			expect(mockDefinition.subscribe).toHaveBeenCalledTimes(1)

			// update it
			manager.handleUpdateFeedbacks({
				[feedbackId]: undefined,
			})

			await runAllTimers()
			expect(mockDefinition.subscribe).toHaveBeenCalledTimes(1)

			expect(manager.getInstanceIds()).toEqual([])
		})

		it('trigger all', async () => {
			// report a feedback
			manager.handleUpdateFeedbacks({
				[feedbackId]: feedback,
				[feedbackId2]: {
					...feedback2,
					feedbackId: mockDefinitionId,
				},
			})

			await runAllTimers()
			expect(mockDefinition.subscribe).toHaveBeenCalledTimes(2)
			expect(manager.getInstanceIds()).toEqual([feedbackId, feedbackId2])

			// trigger unsubscribe
			manager.subscribeFeedbacks([])

			await runAllTimers()
			expect(mockDefinition.subscribe).toHaveBeenCalledTimes(4)
			expect(manager.getInstanceIds()).toEqual([feedbackId, feedbackId2])
		})
	})

	describe('unsubscribe', () => {
		const mockSetFeedbackDefinitions = jest.fn((_msg: SetFeedbackDefinitionsMessage) => null)
		const mockUpdateFeedbackValues = jest.fn((_msg: UpdateFeedbackValuesMessage) => null)
		const manager = new FeedbackManager(
			unimplementedAsyncFunction,
			mockUpdateFeedbackValues,
			mockSetFeedbackDefinitions,
			mockLogger
		)

		const mockDefinition: CompanionFeedbackDefinition = {
			type: 'boolean',
			name: 'Definition0',
			defaultStyle: {},
			options: [],
			callback: jest.fn(async (_fb, _ctx) => false),
			unsubscribe: jest.fn(async (_fb, _ctx) => undefined),
		}

		beforeAll(async () => {
			expect(manager.getDefinitionIds()).toHaveLength(0)
			expect(manager.getInstanceIds()).toHaveLength(0)

			// setup definition
			manager.setFeedbackDefinitions({ [mockDefinitionId]: mockDefinition })
			expect(manager.getDefinitionIds()).toEqual([mockDefinitionId])
			expect(mockSetFeedbackDefinitions).toHaveBeenCalledTimes(1)

			expect(mockDefinition.callback).toHaveBeenCalledTimes(0)
		})

		beforeEach(async () => {
			manager.handleUpdateFeedbacks({
				[feedbackId]: undefined,
				[feedbackId2]: undefined,
			})

			jest.clearAllMocks()
		})

		it('not called when adding', async () => {
			// report a feedback
			manager.handleUpdateFeedbacks({ [feedbackId]: feedback })

			await runAllTimers()
			expect(mockDefinition.unsubscribe).toHaveBeenCalledTimes(0)

			expect(manager.getInstanceIds()).toEqual([feedbackId])
		})

		it('called when updated', async () => {
			// report a feedback
			manager.handleUpdateFeedbacks({ [feedbackId]: feedback })

			await runAllTimers()
			expect(mockDefinition.unsubscribe).toHaveBeenCalledTimes(0)

			// update it
			manager.handleUpdateFeedbacks({
				[feedbackId]: {
					...feedback,
					controlId: 'new-control',
					options: { val: 'changed' },
				},
			})

			await runAllTimers()
			expect(mockDefinition.unsubscribe).toHaveBeenCalledTimes(1)
			expect(mockDefinition.unsubscribe).toHaveBeenLastCalledWith(
				{
					id: feedbackId,
					type: mockDefinition.type,
					feedbackId: mockDefinitionId,
					// with old values are expected for the unsubscribe
					controlId: feedback.controlId,
					options: feedback.options,
				},
				expect.anything()
			)

			expect(manager.getInstanceIds()).toEqual([feedbackId])
		})

		it('called when removed', async () => {
			// report a feedback
			manager.handleUpdateFeedbacks({ [feedbackId]: feedback })

			await runAllTimers()
			expect(mockDefinition.unsubscribe).toHaveBeenCalledTimes(0)

			// update it
			manager.handleUpdateFeedbacks({
				[feedbackId]: undefined,
			})

			await runAllTimers()
			expect(mockDefinition.unsubscribe).toHaveBeenCalledTimes(1)
			expect(mockDefinition.unsubscribe).toHaveBeenLastCalledWith(
				{
					id: feedbackId,
					type: mockDefinition.type,
					feedbackId: mockDefinitionId,
					controlId: feedback.controlId,
					options: feedback.options,
				},
				expect.anything()
			)

			expect(manager.getInstanceIds()).toEqual([])
		})

		it('trigger all', async () => {
			// report a feedback
			manager.handleUpdateFeedbacks({
				[feedbackId]: feedback,
				[feedbackId2]: {
					...feedback2,
					feedbackId: mockDefinitionId,
				},
			})

			await runAllTimers()
			expect(mockDefinition.unsubscribe).toHaveBeenCalledTimes(0)
			expect(manager.getInstanceIds()).toEqual([feedbackId, feedbackId2])

			// trigger unsubscribe
			manager.unsubscribeFeedbacks([])

			await runAllTimers()
			expect(mockDefinition.unsubscribe).toHaveBeenCalledTimes(2)
			expect(manager.getInstanceIds()).toEqual([feedbackId, feedbackId2])
		})
	})
})
