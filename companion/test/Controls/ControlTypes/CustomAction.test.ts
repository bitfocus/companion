import { EventEmitter } from 'node:events'
import { describe, expect, test, vi } from 'vitest'
import { mock, mockDeep } from 'vitest-mock-extended'
import { CUSTOM_ACTIONS_CONNECTION_ID } from '@companion-app/shared/ConnectionId.js'
import { CreateCustomActionControlId } from '@companion-app/shared/ControlId.js'
import type { CustomActionModel } from '@companion-app/shared/Model/CustomActionModel.js'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import {
	EntityModelType,
	FeedbackEntitySubType,
	type ActionEntityModel,
	type FeedbackEntityModel,
	type SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import { exprExpr, exprVal, type AuthorableInputField } from '@companion-app/shared/Model/Options.js'
import { ActionRunner } from '../../../lib/Controls/ActionRunner.js'
import type { ControlDependencies } from '../../../lib/Controls/ControlDependencies.js'
import { ControlStore } from '../../../lib/Controls/ControlStore.js'
import { ControlCustomAction } from '../../../lib/Controls/ControlTypes/CustomAction.js'
import { renameCustomActionInputInCallers } from '../../../lib/Controls/CustomActionTrpcRouter.js'
import type { ControlEntityInstance } from '../../../lib/Controls/Entities/EntityInstance.js'
import type { RunActionExtras } from '../../../lib/Instance/Connection/ChildHandlerApi.js'
import type { InstanceController } from '../../../lib/Instance/Controller.js'
import type { InternalController } from '../../../lib/Internal/Controller.js'
import type { VariablesController } from '../../../lib/Variables/Controller.js'
import { LocalVariablesController } from '../../../lib/Variables/LocalVariablesController.js'
import { VariablesValues } from '../../../lib/Variables/Values.js'
import { mockUserConfig } from '../../utils/MockUserConfig.js'

const CUSTOM_ACTION_ID = 'abc'
const CUSTOM_ACTION_CONTROL_ID = CreateCustomActionControlId(CUSTOM_ACTION_ID)

function getEntityDefinition(
	entityType: EntityModelType,
	connectionId: string,
	definitionId: string
): ClientEntityDefinition | undefined {
	if (entityType === EntityModelType.Feedback) {
		return {
			entityType,
			feedbackType: FeedbackEntitySubType.Value,
			options: [],
			optionsSupportExpressions: true,
		} as Partial<ClientEntityDefinition> as any
	}
	if (connectionId === 'internal') {
		return { entityType, options: [], optionsSupportExpressions: true } as Partial<ClientEntityDefinition> as any
	}
	void definitionId
	return undefined
}

let nextId = 0
function action(definitionId: string, options: ActionEntityModel['options'] = {}): ActionEntityModel {
	return {
		type: EntityModelType.Action,
		id: `action-${nextId++}`,
		connectionId: 'internal',
		definitionId,
		options,
		upgradeIndex: undefined,
	}
}
function callAction(options: ActionEntityModel['options'] = {}, customActionId = CUSTOM_ACTION_ID): ActionEntityModel {
	return {
		type: EntityModelType.Action,
		id: `call-${nextId++}`,
		connectionId: CUSTOM_ACTIONS_CONNECTION_ID,
		definitionId: customActionId,
		options,
		upgradeIndex: undefined,
	}
}
function userValue(variableName: string, startupValue: any): FeedbackEntityModel {
	return {
		type: EntityModelType.Feedback,
		id: `local-${nextId++}`,
		connectionId: 'internal',
		definitionId: 'user_value',
		options: { persist_value: exprVal(false), startup_value: exprVal(startupValue) },
		upgradeIndex: undefined,
		variableName,
	}
}
function computedValue(variableName: string, expression: string): FeedbackEntityModel {
	return {
		type: EntityModelType.Feedback,
		id: `local-${nextId++}`,
		connectionId: 'internal',
		definitionId: 'computed',
		options: { expression: exprVal(expression) },
		upgradeIndex: undefined,
		variableName,
	}
}

const numberInput: AuthorableInputField = {
	type: 'number',
	id: 'n',
	label: 'N',
	default: 3,
	min: 0,
	max: 10,
}

/**
 * Stand up a custom action, with the real classes which run it: the action runner, control store and local
 * variables. Internal actions are handled by `executeAction`, which a test provides.
 */
function createHarness(model: Partial<CustomActionModel>) {
	const variableValues = new VariablesValues(mockUserConfig({ timezone: '' }))

	const pageStore = {
		getLocationOfControlId: vi.fn(() => null),
		getControlIdAt: vi.fn(() => null),
		getPageId: vi.fn(() => undefined),
	}

	const db = { getSchemaTableView: vi.fn(() => ({ set: vi.fn(), delete: vi.fn(), all: vi.fn(() => ({})) })) }
	const controlStore = new ControlStore(db as any, variableValues, pageStore as any)
	const localVariables = new LocalVariablesController(controlStore, pageStore as any)

	const executeAction = vi.fn<(action: ControlEntityInstance, extras: RunActionExtras) => Promise<any>>(
		async () => undefined
	)
	const internalModule = mock<InternalController>()
	internalModule.executeAction.mockImplementation(async (action, extras) => executeAction(action, extras))
	internalModule.evaluateFeedbackValue.mockImplementation((entityModel, _controlId, parser) => {
		// The 'computed' feedback evaluates its expression
		const expression = entityModel.options.expression?.value
		if (typeof expression !== 'string') return undefined
		const res = parser.executeExpression(expression, undefined)
		return res.ok ? res.value : undefined
	})

	const variablesController = mockDeep<VariablesController>()
	const instanceController = mockDeep<InstanceController>()

	const actionRunner = new ActionRunner(
		instanceController,
		controlStore,
		internalModule,
		variablesController,
		localVariables
	)

	const deps: ControlDependencies = {
		surfaces: null as any,
		pageStore: pageStore as any,
		getPageVariableEntities: () => null,
		triggerEvents: null as any,
		expressionVariableNamesMap: null as any,
		internalModule,
		instance: {
			definitions: { getEntityDefinition },
			processManager: null,
		} as any,
		variableValues,
		userconfig: mockUserConfig({ timezone: '' }),
		graphics: null as any,
		actionRunner,
		dbTable: { set: vi.fn(), delete: vi.fn() } as any,
		events: new EventEmitter() as any,
		changeEvents: new EventEmitter() as any,
		renderClock: { subscribe: vi.fn(() => () => {}) } as any,
		controlsAccessor: controlStore,
		linkButtons: null as any,
	}

	const storage: CustomActionModel = {
		type: 'custom-action',
		options: { ...ControlCustomAction.DefaultOptions },
		inputs: [numberInput],
		actions: [],
		localVariables: [],
		...model,
	}
	const control = new ControlCustomAction(deps, CUSTOM_ACTION_CONTROL_ID, structuredClone(storage), false)
	controlStore.controls.set(CUSTOM_ACTION_CONTROL_ID, control)

	/** Evaluate an expression in the context of an executing action */
	const evaluate = (extras: RunActionExtras, expression: string) => {
		const res = controlStore.createActionExecutionParser(extras).executeExpression(expression, undefined)
		return res.ok ? res.value : undefined
	}

	/** Run some actions as if they belong to a button */
	const runAsButton = async (entities: SomeEntityModel[], extras: Partial<RunActionExtras> = {}) => {
		const caller = new ControlCustomAction(deps, 'custom-action:caller', null, false)
		for (const entity of entities) caller.entities.entityAdd('custom_action_actions', null, entity)

		// The store result of an action is resolved asynchronously
		const actions = caller.entities.getActionEntities()
		await vi.waitFor(() => {
			for (const entity of actions) {
				if (entity.rawStoreResult) expect(entity.storeResult).toBeDefined()
			}
		})

		const fullExtras: RunActionExtras = {
			controlId: 'bank:caller',
			surfaceId: 'surface0',
			location: { pageNumber: 2, row: 1, column: 3 },
			abortDelayed: new AbortController().signal,
			executionMode: 'concurrent',
			rotationDelta: null,
			frame: null,
			...extras,
		}
		await actionRunner.runMultipleActions(actions, fullExtras, fullExtras.executionMode === 'sequential')
	}

	return { deps, control, controlStore, localVariables, executeAction, variablesController, evaluate, runAsButton }
}

describe('ControlCustomAction', () => {
	describe('action definition', () => {
		test('describes the inputs and result', () => {
			const { control } = createHarness({
				options: { ...ControlCustomAction.DefaultOptions, name: 'My action', description: 'desc' },
			})

			const definition = control.toActionDefinition()
			expect(definition).toMatchObject({
				entityType: EntityModelType.Action,
				label: 'My action',
				description: 'desc',
				options: [numberInput],
				optionsSupportExpressions: true,
				actionHasResult: false,
				hasLifecycleFunctions: false,
			})

			control.optionsSetField('resultVariable', 'out')
			expect(control.toActionDefinition().actionHasResult).toBe(true)
		})

		test('emits a change when edited', () => {
			const { deps, control } = createHarness({})
			const listener = vi.fn()
			deps.events.on('customActionDefinitionChanged', listener)

			control.optionsSetField('name', 'Renamed')

			expect(listener).toHaveBeenCalledWith(CUSTOM_ACTION_CONTROL_ID)
		})
	})

	describe('inputs', () => {
		test('adds, moves and removes inputs', () => {
			const { control } = createHarness({})
			const checkbox: AuthorableInputField = { type: 'checkbox', id: 'flag', label: 'Flag', default: false }

			expect(control.inputAdd(checkbox)).toBe(true)
			expect(control.inputs.map((input) => input.id)).toEqual(['n', 'flag'])

			expect(control.inputMove('flag', -1)).toBe(true)
			expect(control.inputs.map((input) => input.id)).toEqual(['flag', 'n'])
			expect(control.inputMove('flag', -1)).toBe(false)

			expect(control.inputRemove('flag')).toBe(true)
			expect(control.inputs.map((input) => input.id)).toEqual(['n'])
		})

		test('rejects invalid inputs', () => {
			const { control } = createHarness({})

			// Duplicate id
			expect(control.inputAdd({ ...numberInput })).toBe(false)
			// A type which a user can't author, from somewhere other than the editor
			expect(
				control.inputAdd({ type: 'secret-text', id: 'secret', label: 'Secret' } as unknown as AuthorableInputField)
			).toBe(false)
			// Function visibility
			expect(
				control.inputAdd({
					type: 'checkbox',
					id: 'flag',
					label: 'Flag',
					default: false,
					isVisibleUi: { type: 'function', fn: 'return true' },
				})
			).toBe(false)
			// Bad id
			expect(control.inputAdd({ type: 'checkbox', id: 'a b', label: 'Flag', default: false })).toBe(false)

			expect(control.inputs).toHaveLength(1)
		})

		test('renaming an input updates the references to it', () => {
			const setAction = action('test', {
				text: exprVal('value $(options:n) $(options:nn)'),
				other: exprExpr('$(options:n) + 1'),
			})
			const { control } = createHarness({ actions: [setAction] })

			expect(control.inputUpdate('n', { ...numberInput, id: 'count' })).toBe(true)

			expect(control.inputs.map((input) => input.id)).toEqual(['count'])
			expect(control.entities.getActionEntities()[0].rawOptions).toEqual({
				text: exprVal('value $(options:count) $(options:nn)'),
				other: exprExpr('$(options:count) + 1'),
			})
		})

		test('renaming an input updates the actions which call the custom action', () => {
			const { deps, controlStore } = createHarness({})

			const caller = new ControlCustomAction(deps, 'custom-action:caller', null, false)
			caller.entities.entityAdd('custom_action_actions', null, callAction({ n: exprVal(5) }))
			caller.entities.entityAdd('custom_action_actions', null, callAction({ n: exprVal(6) }, 'other'))
			controlStore.controls.set('custom-action:caller', caller)

			renameCustomActionInputInCallers(controlStore, CUSTOM_ACTION_CONTROL_ID, 'n', 'count')

			const [renamed, untouched] = caller.entities.getActionEntities()
			expect(renamed.rawOptions).toEqual({ count: exprVal(5) })
			expect(untouched.rawOptions).toEqual({ n: exprVal(6) })
		})
	})

	describe('running', () => {
		test('the inputs are available as $(options:x)', async () => {
			const { executeAction, evaluate, runAsButton } = createHarness({ actions: [action('record')] })
			const seen: any[] = []
			executeAction.mockImplementation(async (_action, extras) => {
				seen.push(evaluate(extras, '$(options:n)'))
			})

			await runAsButton([callAction({ n: exprVal(5) }), callAction({ n: exprExpr('2 * 4') })])

			expect(seen.sort()).toEqual([5, 8])
		})

		test('a missing or invalid input uses its default', async () => {
			const { executeAction, evaluate, runAsButton } = createHarness({ actions: [action('record')] })
			const seen: any[] = []
			executeAction.mockImplementation(async (_action, extras) => {
				seen.push(evaluate(extras, '$(options:n)'))
			})

			await runAsButton([callAction({}), callAction({ n: exprExpr('nonsense(') })])

			expect(seen).toEqual([3, 3])
		})

		test('the $(this:*) variables are those of the caller', async () => {
			const { executeAction, evaluate, runAsButton } = createHarness({ actions: [action('record')] })
			const seen: any[] = []
			executeAction.mockImplementation(async (_action, extras) => {
				seen.push(evaluate(extras, '$(this:page)'), evaluate(extras, '$(this:surface_id)'))
			})

			await runAsButton([callAction()])

			expect(seen).toEqual([2, 'surface0'])
		})

		test('local variables are isolated to each run', async () => {
			const { control, executeAction, evaluate, localVariables, runAsButton } = createHarness({
				actions: [action('set'), action('record')],
				localVariables: [userValue('v', 10), computedValue('doubled', '$(local:v) * 2')],
			})

			let releaseSets!: () => void
			const setsDone = new Promise<void>((resolve) => (releaseSets = resolve))
			let setCount = 0

			const seen: any[] = []
			executeAction.mockImplementation(async (action, extras) => {
				if (action.definitionId === 'set') {
					const variable = localVariables.localVariableFor('this', 'v', extras)!
					localVariables.setLocalVariable(variable, evaluate(extras, '$(options:n)'))

					// Wait for both runs to have set their value, so that they overlap
					if (++setCount === 2) releaseSets()
					await setsDone
				} else {
					seen.push([evaluate(extras, '$(local:v)'), evaluate(extras, '$(local:doubled)')])
				}
			})

			await runAsButton([callAction({ n: exprVal(1) }), callAction({ n: exprVal(2) })], {
				executionMode: 'concurrent',
			})

			// Both runs overlap, and each sees only its own value
			expect(seen.sort()).toEqual([
				[1, 2],
				[2, 4],
			])

			// The custom action itself is untouched
			expect(control.entities.getLocalVariableEntities()[0].feedbackValue).toBe(10)
		})

		test('a variable not set in the run has its startup value', async () => {
			const { executeAction, evaluate, runAsButton } = createHarness({
				actions: [action('record')],
				localVariables: [userValue('v', 10)],
			})
			const seen: any[] = []
			executeAction.mockImplementation(async (_action, extras) => {
				seen.push(evaluate(extras, '$(local:v)'))
			})

			await runAsButton([callAction()])

			expect(seen).toEqual([10])
		})

		test('the result is read from the result variable', async () => {
			const { control, executeAction, localVariables, evaluate } = createHarness({
				options: { ...ControlCustomAction.DefaultOptions, resultVariable: 'v' },
				actions: [action('set')],
				localVariables: [userValue('v', 0)],
			})
			executeAction.mockImplementation(async (_action, extras) => {
				const variable = localVariables.localVariableFor('this', 'v', extras)!
				localVariables.setLocalVariable(variable, (evaluate(extras, '$(options:n)') as number) + 100)
			})

			const result = await control.executeCall(
				{ n: 7 },
				{
					controlId: 'bank:caller',
					surfaceId: undefined,
					location: undefined,
					abortDelayed: new AbortController().signal,
					executionMode: 'concurrent',
					rotationDelta: null,
					frame: null,
				}
			)

			expect(result).toBe(107)
		})

		test('the result is stored by the caller', async () => {
			const { executeAction, localVariables, variablesController, runAsButton } = createHarness({
				options: { ...ControlCustomAction.DefaultOptions, resultVariable: 'v' },
				actions: [action('set')],
				localVariables: [userValue('v', 0)],
			})
			executeAction.mockImplementation(async (_action, extras) => {
				localVariables.setLocalVariable(localVariables.localVariableFor('this', 'v', extras)!, 'done')
			})
			variablesController.custom.hasCustomVariable.mockReturnValue(true)

			await runAsButton([
				{
					...callAction(),
					storeResult: { type: 'custom-variable', variableName: exprVal('out'), createIfNotExists: false },
				} as any,
			])

			expect(variablesController.custom.setValue).toHaveBeenCalledWith('out', 'done')
		})

		test('the caller waits for the custom action to finish', async () => {
			const { executeAction, runAsButton } = createHarness({ actions: [action('slow')] })
			const order: string[] = []
			executeAction.mockImplementation(async (action) => {
				if (action.definitionId === 'slow') {
					await new Promise((resolve) => setTimeout(resolve, 5))
					order.push('custom action')
				} else {
					order.push('after')
				}
			})

			await runAsButton([callAction(), action('after')], { executionMode: 'sequential' })

			expect(order).toEqual(['custom action', 'after'])
		})

		test('an aborted caller stops the custom action', async () => {
			const { executeAction, runAsButton } = createHarness({ actions: [action('first'), action('second')] })
			const abort = new AbortController()
			const ran: string[] = []
			executeAction.mockImplementation(async (action) => {
				ran.push(action.definitionId)
				abort.abort()
			})

			await runAsButton([callAction()], { executionMode: 'sequential', abortDelayed: abort.signal })

			expect(ran).toEqual(['first'])
		})

		test('recursion is limited', async () => {
			const { executeAction, runAsButton } = createHarness({ actions: [action('count'), callAction()] })
			let count = 0
			executeAction.mockImplementation(async () => {
				count++
			})

			await runAsButton([callAction()], { executionMode: 'sequential' })

			expect(count).toBe(16)
		})

		test('an unknown custom action does nothing', async () => {
			const { executeAction, runAsButton } = createHarness({ actions: [action('record')] })

			await runAsButton([callAction({}, 'unknown')])

			expect(executeAction).not.toHaveBeenCalled()
		})
	})
})
