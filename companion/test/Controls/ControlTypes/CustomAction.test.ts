import { EventEmitter } from 'node:events'
import { describe, expect, test, vi } from 'vitest'
import { mock, mockDeep } from 'vitest-mock-extended'
import { CUSTOM_ACTIONS_CONNECTION_ID } from '@companion-app/shared/ConnectionId.js'
import {
	CreateBankControlId,
	CreateCustomActionControlId,
	type CustomActionControlId,
} from '@companion-app/shared/ControlId.js'
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
import {
	CUSTOM_ACTION_COPY_ACTIONS_GROUP,
	CUSTOM_ACTION_COPY_LOCAL_VARIABLES_GROUP,
	CustomActionInstanceManager,
} from '../../../lib/Controls/CustomActions/CustomActionInstanceManager.js'
import {
	pruneCustomActionOutputTargets,
	removeCustomActionInputInCallers,
	renameCustomActionInputInCallers,
} from '../../../lib/Controls/CustomActionTrpcRouter.js'
import type { ControlEntityInstance } from '../../../lib/Controls/Entities/EntityInstance.js'
import { ReferencedLocationsIndex } from '../../../lib/Controls/ReferencedLocationsIndex.js'
import type { RunActionExtras } from '../../../lib/Instance/Connection/ChildHandlerApi.js'
import type { InstanceController } from '../../../lib/Instance/Controller.js'
import type { InternalController } from '../../../lib/Internal/Controller.js'
import type { VariablesController } from '../../../lib/Variables/Controller.js'
import { VariableDependencyRegistry } from '../../../lib/Variables/DependencyRegistry.js'
import { LocalVariablesController } from '../../../lib/Variables/LocalVariablesController.js'
import { VariablesValues } from '../../../lib/Variables/Values.js'
import { mockUserConfig } from '../../utils/MockUserConfig.js'

const CUSTOM_ACTION_ID = 'abc'
const CUSTOM_ACTION_CONTROL_ID = CreateCustomActionControlId(CUSTOM_ACTION_ID)
const CALLER_CONTROL_ID = CreateCustomActionControlId('caller')

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

	const processManager = {
		connectionEntityUpdate: vi.fn(async (_entity: ControlEntityInstance, _controlId: string) => true),
		connectionEntityDelete: vi.fn(async (_entity: SomeEntityModel, _controlId: string) => true),
	}

	const renderClock = { subscribe: vi.fn(() => () => {}) } as any
	const variableDependencies = new VariableDependencyRegistry()
	const customActionInstances = new CustomActionInstanceManager(controlStore, renderClock, variableDependencies)

	const actionRunner = new ActionRunner(
		instanceController,
		controlStore,
		internalModule,
		variablesController,
		localVariables,
		customActionInstances
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
			processManager,
		} as any,
		variableValues,
		userconfig: mockUserConfig({ timezone: '' }),
		graphics: null as any,
		actionRunner,
		dbTable: { set: vi.fn(), delete: vi.fn() } as any,
		events: new EventEmitter() as any,
		changeEvents: new EventEmitter() as any,
		renderClock,
		variableDependencies,
		controlsAccessor: controlStore,
		linkButtons: null as any,
		referencedLocations: new ReferencedLocationsIndex(),
		customActionInstances,
	}

	// As the app does, keep the copies held by calling actions up to date
	deps.events.on('customActionDefinitionChanged', (controlId: CustomActionControlId) =>
		customActionInstances.onCustomActionChanged(controlId)
	)
	variableValues.on('variablesChanged', (changed, _labels, controlId) =>
		variableDependencies.dispatch(changed, controlId ? new Set([controlId]) : null)
	)

	const storage: CustomActionModel = {
		type: 'custom-action',
		options: { ...ControlCustomAction.DefaultOptions },
		inputs: [numberInput],
		actions: [],
		localVariables: [],
		outputs: [],
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
		const caller = new ControlCustomAction(deps, CALLER_CONTROL_ID, null, false)
		for (const entity of entities) caller.entities.entityAdd('custom_action_actions', null, entity)

		// The store result of an action is resolved asynchronously
		const actions = caller.entities.getActionEntities()
		await vi.waitFor(() => {
			for (const entity of actions) {
				if (entity.rawStoreResult) expect(entity.storeResult).toBeDefined()
			}
		})

		const fullExtras: RunActionExtras = {
			controlId: CreateBankControlId('caller'),
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

	/** Create a control holding some actions which call custom actions */
	const createCaller = (entities: SomeEntityModel[]) => {
		const caller = new ControlCustomAction(deps, CALLER_CONTROL_ID, null, false)
		for (const entity of entities) caller.entities.entityAdd('custom_action_actions', null, entity)
		controlStore.controls.set(caller.controlId, caller)
		return caller
	}

	return {
		deps,
		control,
		controlStore,
		localVariables,
		executeAction,
		internalModule,
		processManager,
		variablesController,
		variableValues,
		variableDependencies,
		customActionInstances,
		evaluate,
		runAsButton,
		createCaller,
	}
}

describe('ControlCustomAction', () => {
	describe('action definition', () => {
		test('describes the inputs and outputs', () => {
			const { control } = createHarness({
				options: { ...ControlCustomAction.DefaultOptions, name: 'My action', description: 'desc' },
				localVariables: [userValue('v', 0), userValue('unlabelled', 0)],
				outputs: [
					{ variableName: 'v', label: 'Count' },
					{ variableName: 'unlabelled', label: '' },
				],
			})

			const definition = control.toActionDefinition()
			expect(definition).toMatchObject({
				entityType: EntityModelType.Action,
				label: 'My action',
				description: 'desc',
				options: [numberInput],
				optionsSupportExpressions: true,
				actionHasResult: false,
				// An output is known by the name of its variable, which is its label when it has none
				actionOutputs: [
					{ id: 'v', label: 'Count' },
					{ id: 'unlabelled', label: 'unlabelled' },
				],
				hasLifecycleFunctions: false,
			})
		})

		test('emits a change when edited', () => {
			const { deps, control } = createHarness({})
			const listener = vi.fn()
			deps.events.on('customActionDefinitionChanged', listener)

			control.optionsSetField({ key: 'name', value: 'Renamed' })

			expect(listener).toHaveBeenCalledWith(CUSTOM_ACTION_CONTROL_ID)
		})
	})

	describe('actions', () => {
		test('the custom actions it calls leave out disabled calls, which can not make a loop', () => {
			const { control } = createHarness({
				actions: [callAction({}, 'enabled'), { ...callAction({}, 'disabled'), disabled: true }],
			})

			expect([...control.getCalledCustomActionIds()]).toEqual(['enabled'])
		})

		test('an action which calls the custom action itself can not be added', () => {
			const { control } = createHarness({})

			expect(control.entities.entityAdd('custom_action_actions', null, callAction())).toBe(false)
			expect(control.entities.entityAdd('custom_action_actions', null, callAction({}, 'other'))).toBe(true)

			const group: ActionEntityModel = { ...action('logic_if'), children: { actions: [callAction()] } }
			expect(control.entities.entityReplaceAll('custom_action_actions', [group])).toBe(false)

			expect(control.entities.getActionEntities()).toHaveLength(1)
		})
	})

	describe('inputs', () => {
		test('adds, moves and removes inputs', () => {
			const { control } = createHarness({})
			const checkbox: AuthorableInputField = { type: 'checkbox', id: 'flag', label: 'Flag', default: false }

			expect(control.inputAdd(checkbox)).toBe(true)
			expect(control.inputs.map((input) => input.id)).toEqual(['n', 'flag'])

			expect(control.inputMove('flag', 0)).toBe(true)
			expect(control.inputs.map((input) => input.id)).toEqual(['flag', 'n'])
			// Already there, or out of range
			expect(control.inputMove('flag', 0)).toBe(false)
			expect(control.inputMove('flag', 2)).toBe(false)
			expect(control.inputMove('unknown', 1)).toBe(false)

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

		test('renaming an input updates the references to it in where results and outputs are written', () => {
			const resultTarget = {
				type: 'custom-variable' as const,
				variableName: exprExpr("concat('result_', $(options:n))"),
				createIfNotExists: false,
			}
			const call: ActionEntityModel = {
				...callAction({}, 'other'),
				storeResult: resultTarget,
				outputTargets: {
					value: { type: 'local-variable', location: exprVal('this'), variableName: exprExpr('$(options:n)') },
				},
			}
			const { control } = createHarness({ actions: [call] })

			expect(control.inputUpdate('n', { ...numberInput, id: 'count' })).toBe(true)

			const entity = control.entities.getActionEntities()[0]
			expect(entity.rawStoreResult).toEqual({
				...resultTarget,
				variableName: exprExpr("concat('result_', $(options:count))"),
			})
			expect(entity.rawOutputTargets).toEqual({
				value: { type: 'local-variable', location: exprVal('this'), variableName: exprExpr('$(options:count)') },
			})
		})

		test('renaming an input updates the actions which call the custom action', () => {
			const { deps, controlStore } = createHarness({})

			const caller = new ControlCustomAction(deps, CALLER_CONTROL_ID, null, false)
			caller.entities.entityAdd('custom_action_actions', null, callAction({ n: exprVal(5) }))
			caller.entities.entityAdd('custom_action_actions', null, callAction({ n: exprVal(6) }, 'other'))
			controlStore.controls.set(CALLER_CONTROL_ID, caller)

			renameCustomActionInputInCallers(controlStore, CUSTOM_ACTION_CONTROL_ID, 'n', 'count')

			const [renamed, untouched] = caller.entities.getActionEntities()
			expect(renamed.rawOptions).toEqual({ count: exprVal(5) })
			expect(untouched.rawOptions).toEqual({ n: exprVal(6) })
		})

		test('an output follows its local variable being renamed, and callers are told', () => {
			const local = userValue('v', 0)
			const { deps, control } = createHarness({
				localVariables: [local, userValue('other', 0)],
				outputs: [
					{ variableName: 'v', label: 'Out' },
					{ variableName: 'other', label: 'Unrelated' },
				],
			})
			const renamed = vi.fn()
			deps.events.on('customActionOutputRenamed', renamed)

			expect(control.entities.entitySetVariableName('local-variables', local.id, 'renamed')).toBe(true)

			expect(control.outputs).toEqual([
				{ variableName: 'renamed', label: 'Out' },
				{ variableName: 'other', label: 'Unrelated' },
			])
			expect(renamed).toHaveBeenCalledWith(CUSTOM_ACTION_CONTROL_ID, 'v', 'renamed')
		})

		test('renaming a local variable which is not an output does not tell callers', () => {
			const local = userValue('v', 0)
			const { deps, control } = createHarness({ localVariables: [local] })
			const renamed = vi.fn()
			deps.events.on('customActionOutputRenamed', renamed)

			expect(control.entities.entitySetVariableName('local-variables', local.id, 'renamed')).toBe(true)

			expect(renamed).not.toHaveBeenCalled()
		})

		test('only a user value local variable can be an output', () => {
			const { control } = createHarness({
				localVariables: [userValue('v', 0), computedValue('double', '$(options:n) * 2')],
				outputs: [
					{ variableName: 'v', label: 'V' },
					{ variableName: 'double', label: 'Double' },
				],
			})

			expect(control.outputs).toEqual([{ variableName: 'v', label: 'V' }])
			expect(control.outputSet('double', 'Double')).toBe(false)
			expect(control.outputSet('missing', 'Missing')).toBe(false)
		})

		test('an output is turned on, relabelled and off by its local variable', () => {
			const { control } = createHarness({ localVariables: [userValue('v', 0), userValue('w', 0)] })

			expect(control.outputSet('w', 'W')).toBe(true)
			expect(control.outputSet('v', 'V')).toBe(true)
			// In the order of the local variables
			expect(control.outputs).toEqual([
				{ variableName: 'v', label: 'V' },
				{ variableName: 'w', label: 'W' },
			])

			expect(control.outputSet('v', 'Renamed')).toBe(true)
			expect(control.outputs[0]).toEqual({ variableName: 'v', label: 'Renamed' })

			expect(control.outputSet('v', null)).toBe(true)
			expect(control.outputs).toEqual([{ variableName: 'w', label: 'W' }])
			expect(control.toJSON().outputs).toEqual([{ variableName: 'w', label: 'W' }])
		})

		test('removing a local variable removes its output, which a new variable of the same name does not get', () => {
			const local = userValue('v', 0)
			const { control } = createHarness({ localVariables: [local], outputs: [{ variableName: 'v', label: 'V' }] })

			expect(control.entities.entityRemove('local-variables', local.id)).toBe(true)
			expect(control.outputs).toEqual([])

			control.entities.entityAdd('local-variables', null, userValue('v', 0))
			expect(control.outputs).toEqual([])
		})

		test('callers stop writing outputs which their custom action no longer has', () => {
			const { deps, controlStore } = createHarness({})
			const target = { type: 'custom-variable' as const, variableName: exprVal('x'), createIfNotExists: false }

			const caller = new ControlCustomAction(deps, CALLER_CONTROL_ID, null, false)
			caller.entities.entityAdd('custom_action_actions', null, {
				...callAction(),
				outputTargets: { removed: target, kept: target },
			})
			// A call to a custom action which doesn't exist keeps its targets, for if it is imported again
			caller.entities.entityAdd('custom_action_actions', null, {
				...callAction({}, 'missing'),
				outputTargets: { removed: target },
			})
			controlStore.controls.set(CALLER_CONTROL_ID, caller)

			pruneCustomActionOutputTargets(controlStore, new Map([[CUSTOM_ACTION_ID, new Set(['kept'])]]))

			const [changed, untouched] = caller.entities.getActionEntities()
			expect(changed.rawOutputTargets).toEqual({ kept: target })
			expect(untouched.rawOutputTargets).toEqual({ removed: target })
		})

		test('removing an input removes the value given for it by the actions which call the custom action', () => {
			const { deps, controlStore } = createHarness({})

			const caller = new ControlCustomAction(deps, CALLER_CONTROL_ID, null, false)
			caller.entities.entityAdd('custom_action_actions', null, callAction({ n: exprVal(5), m: exprVal(1) }))
			caller.entities.entityAdd('custom_action_actions', null, callAction({ n: exprVal(6) }, 'other'))
			controlStore.controls.set(CALLER_CONTROL_ID, caller)

			removeCustomActionInputInCallers(controlStore, CUSTOM_ACTION_CONTROL_ID, 'n')

			const [removed, untouched] = caller.entities.getActionEntities()
			expect(removed.rawOptions).toEqual({ m: exprVal(1) })
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

		test('a missing input uses its default', async () => {
			const { executeAction, evaluate, runAsButton } = createHarness({ actions: [action('record')] })
			const seen: any[] = []
			executeAction.mockImplementation(async (_action, extras) => {
				seen.push(evaluate(extras, '$(options:n)'))
			})

			await runAsButton([callAction({})])

			expect(seen).toEqual([3])
		})

		test.each([
			['an expression which fails', exprExpr('nonsense(')],
			['a value out of range', exprVal(99)],
		])('an input with %s refuses the run, as a module action does', async (_name, value) => {
			const { executeAction, runAsButton, customActionInstances } = createHarness({ actions: [action('record')] })

			await runAsButton([callAction({ n: value })])

			expect(executeAction).not.toHaveBeenCalled()
			expect(customActionInstances.getRuns(CUSTOM_ACTION_CONTROL_ID)).toEqual([])
		})

		test('a missing text input uses its default', async () => {
			const { control, executeAction, evaluate, runAsButton } = createHarness({ actions: [action('record')] })
			control.inputAdd({ type: 'textinput', id: 'text', label: 'Text', default: 'fallback' })
			const seen: any[] = []
			executeAction.mockImplementation(async (_action, extras) => {
				seen.push(evaluate(extras, '$(options:text)'))
			})

			await runAsButton([callAction({ text: exprVal('given') }), callAction({})], { executionMode: 'sequential' })

			expect(seen).toEqual(['given', 'fallback'])
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

		test('an output is written to the target chosen by the caller each time it is set', async () => {
			const { executeAction, localVariables, variablesController, runAsButton } = createHarness({
				actions: [action('count')],
				localVariables: [userValue('v', 0)],
				outputs: [{ variableName: 'v', label: 'Count' }],
			})
			executeAction.mockImplementation(async (_action, extras) => {
				const variable = localVariables.localVariableFor('this', 'v', extras)!
				for (let i = 1; i <= 3; i++) localVariables.setLocalVariable(variable, i)
			})
			variablesController.custom.hasCustomVariable.mockReturnValue(true)

			await runAsButton([
				{
					...callAction(),
					outputTargets: {
						v: { type: 'custom-variable', variableName: exprVal('out'), createIfNotExists: false },
					},
				},
			])

			// Each value as it is set, then the final value once the run is done
			expect(variablesController.custom.setValue.mock.calls).toEqual([
				['out', 1],
				['out', 2],
				['out', 3],
				['out', 3],
			])
		})

		test('an output is not written once the run is aborted', async () => {
			const { executeAction, localVariables, variablesController, runAsButton } = createHarness({
				actions: [action('count')],
				localVariables: [userValue('v', 0)],
				outputs: [{ variableName: 'v', label: 'Count' }],
			})
			const abort = new AbortController()
			executeAction.mockImplementation(async (_action, extras) => {
				const variable = localVariables.localVariableFor('this', 'v', extras)!
				localVariables.setLocalVariable(variable, 1)
				abort.abort()
				// Such as an action which carries on after it is aborted
				localVariables.setLocalVariable(variable, 2)
			})
			variablesController.custom.hasCustomVariable.mockReturnValue(true)

			await runAsButton(
				[
					{
						...callAction(),
						outputTargets: {
							v: { type: 'custom-variable', variableName: exprVal('out'), createIfNotExists: false },
						},
					},
				],
				{ abortDelayed: abort.signal }
			)

			expect(variablesController.custom.setValue.mock.calls).toEqual([['out', 1]])
		})

		test('the final value of an output is written, even if it is never set', async () => {
			const { variablesController, runAsButton } = createHarness({
				actions: [action('nothing')],
				localVariables: [userValue('v', 5)],
				outputs: [{ variableName: 'v', label: 'V' }],
			})
			variablesController.custom.hasCustomVariable.mockReturnValue(true)

			await runAsButton([
				{
					...callAction(),
					outputTargets: {
						v: { type: 'custom-variable', variableName: exprVal('out'), createIfNotExists: false },
					},
				},
			])

			expect(variablesController.custom.setValue).toHaveBeenCalledWith('out', 5)
		})

		test('an output without a target, or a target for something which is not an output, is not written', async () => {
			const { executeAction, localVariables, variablesController, runAsButton } = createHarness({
				actions: [action('set')],
				localVariables: [userValue('v', 0)],
				outputs: [{ variableName: 'v', label: 'Discarded' }],
			})
			executeAction.mockImplementation(async (_action, extras) => {
				localVariables.setLocalVariable(localVariables.localVariableFor('this', 'v', extras)!, 1)
			})
			variablesController.custom.hasCustomVariable.mockReturnValue(true)

			await runAsButton([
				{
					...callAction(),
					outputTargets: {
						unknown: { type: 'custom-variable', variableName: exprVal('out'), createIfNotExists: false },
					},
				},
			])

			expect(variablesController.custom.setValue).not.toHaveBeenCalled()
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

		test('a run in progress is listed, by the action which called it, until it finishes', async () => {
			const { executeAction, runAsButton, customActionInstances } = createHarness({ actions: [action('first')] })
			const call = callAction()
			let seenDuringRun: unknown = null
			executeAction.mockImplementation(async () => {
				seenDuringRun = customActionInstances.getRuns(CUSTOM_ACTION_CONTROL_ID)
			})
			const changed = vi.fn()
			customActionInstances.events.on('usageChanged', changed)

			await runAsButton([call])

			expect(seenDuringRun).toEqual([
				{
					run: { runId: expect.any(String), controlId: CALLER_CONTROL_ID, startedAt: expect.any(Number) },
					useEntityId: call.id,
				},
			])
			expect(customActionInstances.getRuns(CUSTOM_ACTION_CONTROL_ID)).toEqual([])
			expect(changed).toHaveBeenCalled()
		})

		test('aborting the runs of a custom action stops them, but not the rest of what the caller is doing', async () => {
			const { executeAction, runAsButton, customActionInstances } = createHarness({
				actions: [action('first'), action('second')],
			})
			const ran: string[] = []
			executeAction.mockImplementation(async (action) => {
				ran.push(action.definitionId)
				if (action.definitionId === 'first') {
					expect(customActionInstances.abortRuns(CUSTOM_ACTION_CONTROL_ID, null)).toBe(1)
				}
			})

			await runAsButton([callAction(), action('after')], { executionMode: 'sequential' })

			expect(ran).toEqual(['first', 'after'])
		})

		test('aborting the runs called by one action leaves the others', async () => {
			const { executeAction, runAsButton, customActionInstances } = createHarness({ actions: [action('slow')] })
			const stopped = callAction({ n: exprVal(1) })
			const kept = callAction({ n: exprVal(2) })
			const finished: unknown[] = []
			executeAction.mockImplementation(async (_action, extras) => {
				await new Promise((resolve) => setTimeout(resolve, 300))
				if (!extras.abortDelayed.aborted) finished.push(extras.frame?.options.n)
			})

			const run = runAsButton([stopped, kept])
			await vi.waitFor(() => expect(customActionInstances.getRuns(CUSTOM_ACTION_CONTROL_ID)).toHaveLength(2), {
				interval: 5,
			})
			expect(customActionInstances.abortRuns(CUSTOM_ACTION_CONTROL_ID, stopped.id)).toBe(1)
			await run

			expect(finished).toEqual([2])
		})

		test('a custom action which calls itself does not run itself', async () => {
			// Saved before calling itself was prevented
			const { executeAction, runAsButton } = createHarness({ actions: [action('count'), callAction()] })
			let count = 0
			executeAction.mockImplementation(async () => {
				count++
			})

			await runAsButton([callAction()], { executionMode: 'sequential' })

			expect(count).toBe(1)
		})

		test('custom actions calling each other stop before they loop', async () => {
			const { deps, controlStore, executeAction, runAsButton } = createHarness({
				actions: [action('count'), callAction({}, 'other')],
			})
			const other = new ControlCustomAction(
				deps,
				CreateCustomActionControlId('other'),
				{
					type: 'custom-action',
					options: { ...ControlCustomAction.DefaultOptions },
					inputs: [],
					actions: [callAction()],
					localVariables: [],
					outputs: [],
				},
				false
			)
			controlStore.controls.set(other.controlId, other)

			let count = 0
			executeAction.mockImplementation(async () => {
				count++
			})

			await runAsButton([callAction()], { executionMode: 'sequential' })

			// The first custom action runs, and calls the other one, but that calling it back again does nothing
			expect(count).toBe(1)
		})

		test('an unknown custom action does nothing', async () => {
			const { executeAction, runAsButton } = createHarness({ actions: [action('record')] })

			await runAsButton([callAction({}, 'unknown')])

			expect(executeAction).not.toHaveBeenCalled()
		})
	})

	describe('copies held by calling actions', () => {
		/** Evaluate an expression in the scope of the copy held by an action */
		const evaluateInCopy = (
			customActionInstances: CustomActionInstanceManager,
			caller: ControlCustomAction,
			callerEntity: ControlEntityInstance,
			expression: string
		) => {
			const scope = customActionInstances.getCopyScope(callerEntity)
			if (!scope) return 'no copy'
			const res = scope.createVariablesAndExpressionParser(null).executeExpression(expression, undefined)
			return res.ok ? res.value : undefined
		}

		test('a calling action holds a copy of the actions and local variables', () => {
			const recordAction = action('record', { text: exprVal('$(options:n)') })
			const local = userValue('v', 7)
			const { createCaller, internalModule } = createHarness({ actions: [recordAction], localVariables: [local] })

			const caller = createCaller([callAction({ n: exprVal(5) })])
			const callerEntity = caller.entities.getActionEntities()[0]

			const copyActions = callerEntity.getTransientChildGroup(CUSTOM_ACTION_COPY_ACTIONS_GROUP)
			expect(copyActions?.getDirectEntities().map((e) => e.id)).toEqual([`${callerEntity.id}/${recordAction.id}`])
			const copyLocals = callerEntity.getTransientChildGroup(CUSTOM_ACTION_COPY_LOCAL_VARIABLES_GROUP)
			expect(copyLocals?.getDirectEntities().map((e) => e.id)).toEqual([`${callerEntity.id}/${local.id}`])

			// The copy is subscribed in the control holding it
			expect(internalModule.entityUpdate).toHaveBeenCalledWith(
				expect.objectContaining({ id: `${callerEntity.id}/${recordAction.id}` }),
				caller.controlId,
				expect.any(Function)
			)

			// The copy is never persisted
			expect(callerEntity.asEntityModel()).not.toHaveProperty('children')
			expect(caller.toJSON().actions).toEqual([expect.not.objectContaining({ children: expect.anything() })])
		})

		test('the copy sees the inputs given by the calling action, and the local variables at their startup values', () => {
			const { createCaller, customActionInstances } = createHarness({
				localVariables: [userValue('v', 7), computedValue('double', '$(options:n) * 2')],
			})

			const caller = createCaller([callAction({ n: exprVal(5) }), callAction({})])
			const [given, missing] = caller.entities.getActionEntities()

			expect(evaluateInCopy(customActionInstances, caller, given, '$(options:n)')).toBe(5)
			expect(evaluateInCopy(customActionInstances, caller, given, '$(local:v)')).toBe(7)
			expect(evaluateInCopy(customActionInstances, caller, given, '$(local:double)')).toBe(10)

			// An input which isn't given has its default value
			expect(evaluateInCopy(customActionInstances, caller, missing, '$(options:n)')).toBe(3)
		})

		test('the inputs of the copy follow the options of the calling action', () => {
			const recordAction = action('record')
			const { createCaller, customActionInstances, internalModule } = createHarness({ actions: [recordAction] })

			const caller = createCaller([callAction({ n: exprVal(5) })])
			const callerEntity = caller.entities.getActionEntities()[0]
			internalModule.entityUpdate.mockClear()

			caller.entities.entitySetOption('custom_action_actions', callerEntity.id, 'n', exprVal(6))

			expect(evaluateInCopy(customActionInstances, caller, callerEntity, '$(options:n)')).toBe(6)

			// The entities of the copy are re-subscribed, so that they parse with the new inputs
			expect(internalModule.entityUpdate).toHaveBeenCalledWith(
				expect.objectContaining({ id: `${callerEntity.id}/${recordAction.id}` }),
				caller.controlId,
				expect.any(Function)
			)
		})

		test('the inputs of the copy follow the variables they use', () => {
			const recordAction = action('record')
			const { createCaller, customActionInstances, internalModule, variableValues } = createHarness({
				actions: [recordAction],
			})
			variableValues.setVariableValues('test', [{ id: 'num', value: 1 }])

			const caller = createCaller([callAction({ n: exprExpr('$(test:num) + 1') })])
			const callerEntity = caller.entities.getActionEntities()[0]
			expect(evaluateInCopy(customActionInstances, caller, callerEntity, '$(options:n)')).toBe(2)
			internalModule.entityUpdate.mockClear()

			// An unrelated variable doesn't re-subscribe the copy
			variableValues.setVariableValues('test', [{ id: 'other', value: 1 }])
			expect(internalModule.entityUpdate).not.toHaveBeenCalled()

			variableValues.setVariableValues('test', [{ id: 'num', value: 4 }])

			expect(evaluateInCopy(customActionInstances, caller, callerEntity, '$(options:n)')).toBe(5)
			expect(internalModule.entityUpdate).toHaveBeenCalledWith(
				expect.objectContaining({ id: `${callerEntity.id}/${recordAction.id}` }),
				caller.controlId,
				expect.any(Function)
			)
		})

		test('the variables used by the inputs are forgotten when the calling action is removed', () => {
			const { createCaller, customActionInstances, variableValues, variableDependencies } = createHarness({
				actions: [action('record')],
			})
			variableValues.setVariableValues('test', [{ id: 'num', value: 1 }])

			const caller = createCaller([])
			const dependenciesWithoutCopy = variableDependencies.stats().dependencies

			caller.entities.entityAdd('custom_action_actions', null, callAction({ n: exprExpr('$(test:num) + 1') }))
			const callerEntity = caller.entities.getActionEntities()[0]
			expect(variableDependencies.stats().dependencies).toBeGreaterThan(dependenciesWithoutCopy)

			const notified = vi.spyOn(customActionInstances, 'onVariableDependenciesChanged')
			caller.entities.entityRemove('custom_action_actions', callerEntity.id)
			variableValues.setVariableValues('test', [{ id: 'num', value: 2 }])

			expect(notified).not.toHaveBeenCalled()
			expect(variableDependencies.stats().dependencies).toBe(dependenciesWithoutCopy)
		})

		test('the copy is inactive while its inputs are invalid, as a module feedback is, until they are valid again', () => {
			const { createCaller, customActionInstances, variableValues } = createHarness({ actions: [action('record')] })
			variableValues.setVariableValues('test', [{ id: 'num', value: 99 }])

			const caller = createCaller([callAction({ n: exprExpr('$(test:num)') })])
			const callerEntity = caller.entities.getActionEntities()[0]
			expect(customActionInstances.getCopyScope(callerEntity)).toBeUndefined()
			expect(callerEntity.getTransientChildGroup(CUSTOM_ACTION_COPY_ACTIONS_GROUP)).toBeUndefined()

			// A variable it uses makes it valid
			variableValues.setVariableValues('test', [{ id: 'num', value: 4 }])
			expect(evaluateInCopy(customActionInstances, caller, callerEntity, '$(options:n)')).toBe(4)

			// And invalid again
			variableValues.setVariableValues('test', [{ id: 'num', value: 99 }])
			expect(customActionInstances.getCopyScope(callerEntity)).toBeUndefined()
			expect(callerEntity.getTransientChildGroup(CUSTOM_ACTION_COPY_ACTIONS_GROUP)).toBeUndefined()
		})

		test('the copy is not re-subscribed when a variable change leaves its inputs the same', () => {
			const { createCaller, internalModule, variableValues } = createHarness({ actions: [action('record')] })
			variableValues.setVariableValues('test', [{ id: 'num', value: 1 }])

			createCaller([callAction({ n: exprExpr('$(test:num) * 0 + 5') })])
			internalModule.entityUpdate.mockClear()

			variableValues.setVariableValues('test', [{ id: 'num', value: 2 }])

			expect(internalModule.entityUpdate).not.toHaveBeenCalled()
		})

		/** Run the custom action called by an action, as a button would */
		const runCall = async (
			harness: ReturnType<typeof createHarness>,
			caller: ControlCustomAction,
			callerEntity: ControlEntityInstance,
			extras: Partial<RunActionExtras> = {}
		) => {
			const fullExtras: RunActionExtras = {
				controlId: caller.controlId,
				surfaceId: 'surface0',
				location: undefined,
				abortDelayed: new AbortController().signal,
				executionMode: 'sequential',
				rotationDelta: null,
				frame: null,
				...extras,
			}
			return harness.customActionInstances.runCall(
				callerEntity,
				harness.controlStore.createActionExecutionParser(fullExtras),
				fullExtras,
				() => {}
			)
		}

		/** A local variable which is the value of a connection feedback */
		const connectionLocal = (variableName: string): FeedbackEntityModel => ({
			type: EntityModelType.Feedback,
			id: `local-${nextId++}`,
			connectionId: 'conn1',
			definitionId: 'tally',
			options: {},
			upgradeIndex: undefined,
			variableName,
		})

		test('a run uses a copy of its own, with the inputs as they were when it started', async () => {
			const recordAction = action('record')
			const harness = createHarness({ actions: [recordAction, action('second')] })
			const { createCaller, customActionInstances, executeAction, evaluate } = harness

			const caller = createCaller([callAction({ n: exprVal(5) })])
			const callerEntity = caller.entities.getActionEntities()[0]

			const ranIds: string[] = []
			const seen: any[] = []
			executeAction.mockImplementation(async (entity, extras) => {
				ranIds.push(entity.id)
				// Change the input part way through the run
				if (entity.definitionId === 'record') {
					caller.entities.entitySetOption('custom_action_actions', callerEntity.id, 'n', exprVal(9))
				}
				seen.push(evaluate(extras, '$(options:n)'))
			})

			await runCall(harness, caller, callerEntity)

			// The run kept the inputs it started with
			expect(seen).toEqual([5, 5])
			// But the copy held by the caller follows the change
			expect(evaluateInCopy(customActionInstances, caller, callerEntity, '$(options:n)')).toBe(9)

			// The run used its own copy of the actions, which is removed once it is done
			expect(ranIds[0]).toMatch(new RegExp(`^${callerEntity.id}@.+/${recordAction.id}$`))
			expect(caller.entities.getAllEntitiesWithTransient().some((entity) => entity.id.includes('@'))).toBe(false)
		})

		test('a run starts with the values of the copy held by the caller', async () => {
			const local = connectionLocal('camera')
			const harness = createHarness({ actions: [action('record')], localVariables: [local] })
			const { createCaller, executeAction, evaluate } = harness

			const caller = createCaller([callAction({ n: exprVal(5) })])
			const callerEntity = caller.entities.getActionEntities()[0]

			// The connection reports a value for the copy
			const copyLocalId = `${callerEntity.id}/${local.id}`
			caller.entities.updateFeedbackValues(
				'conn1',
				new Map([[copyLocalId, { entityId: copyLocalId, controlId: caller.controlId, value: 'live' }]])
			)

			const seen: any[] = []
			executeAction.mockImplementation(async (_entity, extras) => {
				seen.push(evaluate(extras, '$(local:camera)'))
			})

			await runCall(harness, caller, callerEntity)

			expect(seen).toEqual(['live'])
		})

		test('a run with different inputs to the copy does not start with its values', async () => {
			const local = connectionLocal('camera')
			const harness = createHarness({ actions: [action('record')], localVariables: [local] })
			const { createCaller, executeAction, evaluate } = harness

			// The input is different when run, as the copy has no surface
			const caller = createCaller([callAction({ n: exprExpr(`$(this:surface_id) == 'surface0' ? 1 : 2`) })])
			const callerEntity = caller.entities.getActionEntities()[0]

			const copyLocalId = `${callerEntity.id}/${local.id}`
			caller.entities.updateFeedbackValues(
				'conn1',
				new Map([[copyLocalId, { entityId: copyLocalId, controlId: caller.controlId, value: 'live' }]])
			)

			const seen: any[] = []
			executeAction.mockImplementation(async (_entity, extras) => {
				seen.push([evaluate(extras, '$(options:n)'), evaluate(extras, '$(local:camera)')])
			})

			await runCall(harness, caller, callerEntity)

			expect(seen).toEqual([[1, undefined]])
		})

		test('the connection entities of a run are re-parsed when its local variables change', async () => {
			const moduleAction: ActionEntityModel = {
				type: EntityModelType.Action,
				id: `module-${nextId++}`,
				connectionId: 'conn1',
				definitionId: 'do',
				options: { text: exprVal('$(local:v)') },
				upgradeIndex: undefined,
				// Not run, it is only here to be subscribed
				disabled: true,
			}
			const harness = createHarness({
				actions: [action('set'), moduleAction, action('check')],
				localVariables: [userValue('v', 0)],
			})
			const { createCaller, executeAction, localVariables, processManager } = harness

			const caller = createCaller([callAction({ n: exprVal(5) })])
			const callerEntity = caller.entities.getActionEntities()[0]

			const runSubscriptions = () =>
				processManager.connectionEntityUpdate.mock.calls.filter(([entity]) => entity.id.includes('@')).length

			let subscriptionsBeforeSet = 0
			let subscriptionsAfterSet = 0
			executeAction.mockImplementation(async (entity, extras) => {
				if (entity.definitionId === 'set') {
					subscriptionsBeforeSet = runSubscriptions()
					localVariables.setLocalVariable(localVariables.localVariableFor('this', 'v', extras)!, 1)
				} else if (entity.definitionId === 'check') {
					await vi.waitFor(() => expect(runSubscriptions()).toBeGreaterThan(subscriptionsBeforeSet))
					subscriptionsAfterSet = runSubscriptions()
				}
			})

			await runCall(harness, caller, callerEntity)

			expect(subscriptionsBeforeSet).toBe(1)
			expect(subscriptionsAfterSet).toBe(2)
		})

		test('the copy is rebuilt when the custom action changes', async () => {
			const { control, createCaller } = createHarness({ actions: [action('first')] })

			const caller = createCaller([callAction({ n: exprVal(5) })])
			const callerEntity = caller.entities.getActionEntities()[0]

			const added = action('second')
			control.entities.entityAdd('custom_action_actions', null, added)

			await vi.waitFor(() => {
				expect(
					callerEntity
						.getTransientChildGroup(CUSTOM_ACTION_COPY_ACTIONS_GROUP)
						?.getDirectEntities()
						.map((e) => e.definitionId)
				).toEqual(['first', 'second'])
			})
		})

		test('the copy is removed with the custom action', async () => {
			const { control, controlStore, createCaller, customActionInstances } = createHarness({
				actions: [action('first')],
			})

			const caller = createCaller([callAction({ n: exprVal(5) })])
			const callerEntity = caller.entities.getActionEntities()[0]

			// As the controls controller deletes a control
			control.destroy()
			controlStore.controls.delete(control.controlId)

			await vi.waitFor(() => {
				expect(callerEntity.getTransientChildGroup(CUSTOM_ACTION_COPY_ACTIONS_GROUP)).toBeUndefined()
			})
			expect(customActionInstances.getCopyScope(callerEntity)).toBeUndefined()
		})

		test('the copy is removed when the calling action is disabled or removed', () => {
			const recordAction = action('record')
			const { createCaller, customActionInstances, internalModule } = createHarness({ actions: [recordAction] })

			const caller = createCaller([callAction({ n: exprVal(5) })])
			const callerEntity = caller.entities.getActionEntities()[0]
			const copyId = `${callerEntity.id}/${recordAction.id}`

			caller.entities.entityEnabled('custom_action_actions', callerEntity.id, false)
			expect(callerEntity.getTransientChildGroup(CUSTOM_ACTION_COPY_ACTIONS_GROUP)).toBeUndefined()
			expect(customActionInstances.getCopyScope(callerEntity)).toBeUndefined()
			expect(internalModule.entityDelete).toHaveBeenCalledWith(expect.objectContaining({ id: copyId }))

			caller.entities.entityEnabled('custom_action_actions', callerEntity.id, true)
			expect(callerEntity.getTransientChildGroup(CUSTOM_ACTION_COPY_ACTIONS_GROUP)).toBeDefined()

			internalModule.entityDelete.mockClear()
			caller.entities.entityRemove('custom_action_actions', callerEntity.id)
			expect(customActionInstances.getCopyScope(callerEntity)).toBeUndefined()
			expect(internalModule.entityDelete).toHaveBeenCalledWith(expect.objectContaining({ id: copyId }))
		})

		test('a copy holds copies of the custom actions it calls, with their own inputs', () => {
			const { deps, controlStore, createCaller, customActionInstances } = createHarness({
				actions: [callAction({ n: exprExpr('$(options:n) + 1') }, 'inner')],
			})
			const inner = new ControlCustomAction(
				deps,
				CreateCustomActionControlId('inner'),
				{
					type: 'custom-action',
					options: { ...ControlCustomAction.DefaultOptions },
					inputs: [numberInput],
					actions: [action('record')],
					localVariables: [],
					outputs: [],
				},
				false
			)
			controlStore.controls.set(inner.controlId, inner)

			const caller = createCaller([callAction({ n: exprVal(5) })])
			const callerEntity = caller.entities.getActionEntities()[0]

			const nestedCall = callerEntity.getTransientChildGroup(CUSTOM_ACTION_COPY_ACTIONS_GROUP)!.getDirectEntities()[0]
			expect(evaluateInCopy(customActionInstances, caller, nestedCall, '$(options:n)')).toBe(6)
			expect(
				nestedCall
					.getTransientChildGroup(CUSTOM_ACTION_COPY_ACTIONS_GROUP)
					?.getDirectEntities()
					.map((e) => e.definitionId)
			).toEqual(['record'])
		})

		test('a loop of custom actions is not copied', () => {
			const { deps, controlStore, createCaller, customActionInstances } = createHarness({
				actions: [callAction({}, 'other')],
			})
			const other = new ControlCustomAction(
				deps,
				CreateCustomActionControlId('other'),
				{
					type: 'custom-action',
					options: { ...ControlCustomAction.DefaultOptions },
					inputs: [],
					actions: [callAction()],
					localVariables: [],
					outputs: [],
				},
				false
			)
			controlStore.controls.set(other.controlId, other)

			const caller = createCaller([callAction()])
			const callerEntity = caller.entities.getActionEntities()[0]

			// The caller holds a copy of the custom action, which holds a copy of the other one
			const callOther = callerEntity.getTransientChildGroup(CUSTOM_ACTION_COPY_ACTIONS_GROUP)!.getDirectEntities()[0]
			const callBack = callOther.getTransientChildGroup(CUSTOM_ACTION_COPY_ACTIONS_GROUP)!.getDirectEntities()[0]
			expect(callBack.definitionId).toBe(CUSTOM_ACTION_ID)

			// But that calls the first custom action again, so isn't copied
			expect(callBack.getTransientChildGroup(CUSTOM_ACTION_COPY_ACTIONS_GROUP)).toBeUndefined()
			expect(customActionInstances.getCopyScope(callBack)).toBeUndefined()
		})

		test('custom actions nested too deeply are not copied', () => {
			const { deps, controlStore, createCaller } = createHarness({ actions: [callAction({}, 'level-1')] })

			// A chain of custom actions, each calling the next
			for (let i = 1; i <= 20; i++) {
				const level = new ControlCustomAction(
					deps,
					CreateCustomActionControlId(`level-${i}`),
					{
						type: 'custom-action',
						options: { ...ControlCustomAction.DefaultOptions },
						inputs: [],
						actions: [callAction({}, `level-${i + 1}`)],
						localVariables: [],
						outputs: [],
					},
					false
				)
				controlStore.controls.set(level.controlId, level)
			}

			const caller = createCaller([callAction({}, 'level-1')])

			let depth = 0
			let entity: ControlEntityInstance | undefined = caller.entities.getActionEntities()[0]
			while (entity) {
				const group = entity.getTransientChildGroup(CUSTOM_ACTION_COPY_ACTIONS_GROUP)
				if (!group) break
				depth++
				entity = group.getDirectEntities()[0]
			}

			// The caller here is a custom action itself, so is the first of the levels allowed
			expect(depth).toBe(15)
		})
	})
})
