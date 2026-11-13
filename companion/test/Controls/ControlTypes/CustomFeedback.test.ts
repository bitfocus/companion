import { EventEmitter } from 'node:events'
import { describe, expect, test, vi } from 'vitest'
import { mock } from 'vitest-mock-extended'
import { CUSTOM_CONNECTION_ID, INTERNAL_CONNECTION_ID } from '@companion-app/shared/ConnectionId.js'
import {
	CreateCustomFeedbackControlId,
	type CustomFeedbackControlId,
	type SomeControlId,
} from '@companion-app/shared/ControlId.js'
import {
	CustomFeedbackOptionsSchema,
	type CustomFeedbackModel,
} from '@companion-app/shared/Model/CustomFeedbackModel.js'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import {
	EntityModelType,
	FeedbackEntitySubType,
	type FeedbackEntityModel,
	type SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import { exprExpr, exprVal, type AuthorableInputField } from '@companion-app/shared/Model/Options.js'
import {
	removeBuildingBlockInputInCallers,
	renameBuildingBlockInputInCallers,
} from '../../../lib/Controls/BuildingBlocks/BuildingBlockCallers.js'
import type { ControlDependencies } from '../../../lib/Controls/ControlDependencies.js'
import { ControlStore } from '../../../lib/Controls/ControlStore.js'
import { ControlCustomFeedback } from '../../../lib/Controls/ControlTypes/CustomFeedback.js'
import { MAX_CUSTOM_ACTION_DEPTH } from '../../../lib/Controls/CustomActionRunFrame.js'
import { CustomActionInstanceManager } from '../../../lib/Controls/CustomActions/CustomActionInstanceManager.js'
import { CustomFeedbackInstanceManager } from '../../../lib/Controls/CustomFeedbacks/CustomFeedbackInstanceManager.js'
import type { ControlEntityInstance } from '../../../lib/Controls/Entities/EntityInstance.js'
import type { FeedbackExecutionContext } from '../../../lib/Controls/Entities/Types.js'
import { ReferencedLocationsIndex } from '../../../lib/Controls/ReferencedLocationsIndex.js'
import type { InternalController } from '../../../lib/Internal/Controller.js'
import {
	VariableDependencyRegistry,
	type VariableDependency,
	type VariableDependencyListener,
} from '../../../lib/Variables/DependencyRegistry.js'
import { VariablesValues } from '../../../lib/Variables/Values.js'
import { mockUserConfig } from '../../utils/MockUserConfig.js'

const CUSTOM_FEEDBACK_ID = 'abc'
const CUSTOM_FEEDBACK_CONTROL_ID = CreateCustomFeedbackControlId(CUSTOM_FEEDBACK_ID)
const CALLER_CONTROL_ID = CreateCustomFeedbackControlId('caller')

let nextId = 0
/** An internal boolean feedback, which is true when its expression is truthy */
function check(expression: string): FeedbackEntityModel {
	return {
		type: EntityModelType.Feedback,
		id: `check-${nextId++}`,
		connectionId: INTERNAL_CONNECTION_ID,
		definitionId: 'check_expression',
		options: { expression: exprVal(expression) },
		upgradeIndex: undefined,
	}
}
function useFeedback(options: FeedbackEntityModel['options'] = {}, customFeedbackId = CUSTOM_FEEDBACK_ID) {
	return {
		type: EntityModelType.Feedback,
		id: `use-${nextId++}`,
		connectionId: CUSTOM_CONNECTION_ID,
		definitionId: customFeedbackId,
		options,
		upgradeIndex: undefined,
	} satisfies FeedbackEntityModel
}
function computedValue(variableName: string, expression: string): FeedbackEntityModel {
	return {
		type: EntityModelType.Feedback,
		id: `local-${nextId++}`,
		connectionId: INTERNAL_CONNECTION_ID,
		definitionId: 'computed',
		options: { expression: exprVal(expression) },
		upgradeIndex: undefined,
		variableName,
	}
}
function moduleValue(variableName: string): FeedbackEntityModel {
	return {
		type: EntityModelType.Feedback,
		id: `local-${nextId++}`,
		connectionId: 'conn',
		definitionId: 'level',
		options: {},
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
 * Stand up a custom feedback, with the real classes which give the feedbacks using it their values. The internal
 * module is a stand in, which evaluates the expression of a `check_expression` feedback when it is subscribed, as the
 * real one does
 */
function createHarness(model: Partial<CustomFeedbackModel>) {
	const variableValues = new VariablesValues(mockUserConfig({ timezone: '' }))

	const pageStore = {
		getLocationOfControlId: vi.fn(() => null),
		getControlIdAt: vi.fn(() => null),
		getPageId: vi.fn(() => undefined),
	}

	const db = { getSchemaTableView: vi.fn(() => ({ set: vi.fn(), delete: vi.fn(), all: vi.fn(() => ({})) })) }
	const controlStore = new ControlStore(db as any, variableValues, pageStore as any)

	const variableDependencies = new VariableDependencyRegistry()
	const checkListener: VariableDependencyListener<string> = {
		onVariableDependenciesChanged: (hits) => {
			for (const hit of hits) evaluateCheck(hit.data)
		},
	}

	const internalModule = mock<InternalController>()
	internalModule.evaluateFeedbackValue.mockImplementation((entityModel, _controlId, parser) => {
		// The 'computed' feedback evaluates its expression
		const expression = entityModel.options.expression?.value
		if (typeof expression !== 'string') return undefined
		const res = parser.executeExpression(expression, undefined)
		return res.ok ? res.value : undefined
	})
	// The `check_expression` feedbacks being tracked, which are evaluated again when a variable they read changes, as
	// the internal feedbacks are, through the dependency registry
	const checkFeedbacks = new Map<
		string,
		{
			controlId: SomeControlId
			expression: string
			createParser: () => any
			dependency: VariableDependency<string>
		}
	>()
	const evaluateCheck = (entityId: string) => {
		const check = checkFeedbacks.get(entityId)
		if (!check) return
		const res = check.createParser().executeExpression(check.expression, undefined)
		check.dependency.set(res.variableIds)
		controlStore.updateFeedbackValues(INTERNAL_CONNECTION_ID, [
			{ entityId, controlId: check.controlId, value: res.ok && !!res.value },
		])
	}
	internalModule.entityUpdate.mockImplementation((entityModel, controlId, createParser) => {
		if (entityModel.type !== EntityModelType.Feedback || entityModel.definitionId !== 'check_expression') return
		if (entityModel.disabled) return

		const expression = entityModel.options.expression?.value
		if (typeof expression !== 'string') return

		checkFeedbacks.get(entityModel.id)?.dependency.dispose()
		const dependency = variableDependencies.create(checkListener, controlId, entityModel.id)
		checkFeedbacks.set(entityModel.id, { controlId, expression, createParser, dependency })
		evaluateCheck(entityModel.id)
	})
	internalModule.entityDelete.mockImplementation((entityModel) => {
		checkFeedbacks.get(entityModel.id)?.dependency.dispose()
		checkFeedbacks.delete(entityModel.id)
	})

	const getEntityDefinition = (
		entityType: EntityModelType,
		connectionId: string,
		definitionId: string
	): ClientEntityDefinition | undefined => {
		if (entityType !== EntityModelType.Feedback) return undefined
		if (connectionId === CUSTOM_CONNECTION_ID) {
			const control = controlStore.getControl(CreateCustomFeedbackControlId(definitionId))
			return control instanceof ControlCustomFeedback ? control.toFeedbackDefinition() : undefined
		}
		if (definitionId === 'check_expression' || definitionId === 'is_on') {
			return {
				entityType,
				feedbackType: FeedbackEntitySubType.Boolean,
				showInvert: true,
				options: [],
				optionsSupportExpressions: true,
			} as Partial<ClientEntityDefinition> as any
		}
		return {
			entityType,
			feedbackType: FeedbackEntitySubType.Value,
			options: [],
			optionsSupportExpressions: true,
		} as Partial<ClientEntityDefinition> as any
	}

	const processManager = {
		connectionEntityUpdate: vi.fn(async (_entity: ControlEntityInstance, _controlId: string) => true),
		connectionEntityDelete: vi.fn(async (_entity: SomeEntityModel, _controlId: string) => true),
	}

	const renderClock = { subscribe: vi.fn(() => () => {}) } as any
	const customFeedbackInstances = new CustomFeedbackInstanceManager(controlStore, renderClock, variableDependencies)
	const customActionInstances = new CustomActionInstanceManager(
		controlStore,
		renderClock,
		variableDependencies,
		customFeedbackInstances
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
		actionRunner: null as any,
		dbTable: { set: vi.fn(), delete: vi.fn() } as any,
		events: new EventEmitter() as any,
		changeEvents: new EventEmitter() as any,
		renderClock,
		variableDependencies,
		controlsAccessor: controlStore,
		linkButtons: null as any,
		referencedLocations: new ReferencedLocationsIndex(),
		customActionInstances,
		customFeedbackInstances,
	}

	// As the controls controller does, keep the copies held by calling feedbacks up to date
	deps.events.on('customFeedbackDefinitionChanged', (controlId: CustomFeedbackControlId) =>
		customFeedbackInstances.onCustomFeedbackChanged(controlId)
	)
	// As the app does, tell the copies and the internal feedbacks of changes to variables
	variableValues.on('variablesChanged', (changed, _labels, controlId) => {
		variableDependencies.dispatch(changed, controlId ? new Set([controlId]) : null)
	})

	const storage: CustomFeedbackModel = {
		type: 'custom-feedback',
		options: CustomFeedbackOptionsSchema.parse({}),
		inputs: [numberInput],
		feedbacks: [],
		localVariables: [],
		...model,
	}
	const control = new ControlCustomFeedback(deps, CUSTOM_FEEDBACK_CONTROL_ID, structuredClone(storage), false)
	controlStore.controls.set(CUSTOM_FEEDBACK_CONTROL_ID, control)

	/** Create a control holding a feedback which uses the custom feedback, and get the feedback */
	const createCaller = (entity: FeedbackEntityModel) => {
		const caller = new ControlCustomFeedback(deps, CALLER_CONTROL_ID, null, false)
		controlStore.controls.set(caller.controlId, caller)
		caller.entities.entityAdd('feedbacks', null, entity)
		const callerEntity = caller.entities.getFeedbackEntities()[0]
		return { caller, callerEntity }
	}

	return { deps, control, controlStore, processManager, customFeedbackInstances, createCaller }
}

/** Wait for the value of a feedback which uses a custom feedback to settle */
async function expectValue(entity: ControlEntityInstance, value: boolean): Promise<void> {
	await vi.waitFor(() => expect(entity.getBooleanFeedbackValue(null)).toBe(value))
}

describe('ControlCustomFeedback', () => {
	describe('feedback definition', () => {
		test('is a boolean feedback, with the inputs as its options', () => {
			const { control } = createHarness({
				options: CustomFeedbackOptionsSchema.parse({ name: 'My feedback', description: 'desc' }),
			})

			expect(control.toFeedbackDefinition()).toMatchObject({
				entityType: EntityModelType.Feedback,
				feedbackType: FeedbackEntitySubType.Boolean,
				label: 'My feedback',
				description: 'desc',
				options: [numberInput],
				showInvert: true,
				optionsSupportExpressions: true,
			})
		})

		test('emits a change when edited', () => {
			const { deps, control } = createHarness({})
			const listener = vi.fn()
			deps.events.on('customFeedbackDefinitionChanged', listener)

			control.optionsSetField({ key: 'name', value: 'Renamed' })

			expect(listener).toHaveBeenCalledWith(CUSTOM_FEEDBACK_CONTROL_ID)
		})
	})

	describe('feedbacks', () => {
		test('a feedback which uses the custom feedback itself can not be added', () => {
			const { control } = createHarness({})

			expect(control.entities.entityAdd('feedbacks', null, useFeedback())).toBe(false)
			expect(control.entities.getFeedbackEntities()).toHaveLength(0)
		})

		test('a feedback using another custom feedback can be added', () => {
			const { deps, control, controlStore } = createHarness({})
			const other = new ControlCustomFeedback(deps, CreateCustomFeedbackControlId('other'), null, false)
			controlStore.controls.set(other.controlId, other)

			expect(control.entities.entityAdd('feedbacks', null, useFeedback({}, 'other'))).toBe(true)
		})
	})

	describe('value of a feedback using it', () => {
		test('is true when all of its feedbacks are, seeing the inputs given', async () => {
			const { createCaller } = createHarness({
				feedbacks: [check('$(options:n) > 4'), check('$(options:n) < 8')],
			})

			const { caller, callerEntity } = createCaller(useFeedback({ n: exprVal(5) }))
			await expectValue(callerEntity, true)

			caller.entities.entitySetOption('feedbacks', callerEntity.id, 'n', exprVal(9))
			await expectValue(callerEntity, false)

			caller.entities.entitySetOption('feedbacks', callerEntity.id, 'n', exprVal(6))
			await expectValue(callerEntity, true)
		})

		test('keeps its value when an input changes without changing it', async () => {
			const { createCaller } = createHarness({ feedbacks: [check('$(options:n) > 4')] })

			const { caller, callerEntity } = createCaller(useFeedback({ n: exprVal(5) }))
			await expectValue(callerEntity, true)

			// Changing an option clears the value of the feedback, so it must be given it again
			caller.entities.entitySetOption('feedbacks', callerEntity.id, 'n', exprVal(6))
			expect(callerEntity.feedbackValue).toBeUndefined()
			await expectValue(callerEntity, true)
		})

		test('uses the default for an input which is not given', async () => {
			const { createCaller } = createHarness({ feedbacks: [check('$(options:n) == 3')] })

			const { callerEntity } = createCaller(useFeedback())
			await expectValue(callerEntity, true)
		})

		test('is false when it has no feedbacks', async () => {
			const { createCaller, controlStore } = createHarness({ feedbacks: [] })
			const updateSpy = vi.spyOn(controlStore, 'updateFeedbackValues')

			const { callerEntity } = createCaller(useFeedback())

			await vi.waitFor(() =>
				expect(updateSpy).toHaveBeenCalledWith(CUSTOM_CONNECTION_ID, [
					{ entityId: callerEntity.id, controlId: CALLER_CONTROL_ID, value: false },
				])
			)
			expect(callerEntity.getBooleanFeedbackValue(null)).toBe(false)
		})

		test('can be inverted', async () => {
			const { createCaller } = createHarness({ feedbacks: [check('true')] })

			const { callerEntity } = createCaller({ ...useFeedback(), isInverted: exprVal(true) })
			await expectValue(callerEntity, false)
		})

		test('sees the local variables of its copy, computed from the inputs', async () => {
			const { createCaller } = createHarness({
				localVariables: [computedValue('double', '$(options:n) * 2')],
				feedbacks: [check('$(local:double) == 10')],
			})

			const { callerEntity } = createCaller(useFeedback({ n: exprVal(5) }))
			await expectValue(callerEntity, true)
		})

		test('follows a local variable which a connection gives a new value', async () => {
			const { createCaller, controlStore, customFeedbackInstances } = createHarness({
				localVariables: [moduleValue('level')],
				feedbacks: [check('$(local:level) > 5')],
			})

			const { callerEntity } = createCaller(useFeedback())
			await expectValue(callerEntity, false)
			// Let the copy be rebuilt for the creation of the custom feedback, so that it is not replaced below
			await new Promise((resolve) => setTimeout(resolve, 150))

			// The connection reports the value for the copy of the local variable held by the caller
			const [localVariable] = customFeedbackInstances.getHeldCopy(callerEntity)!.localVariables.getDirectEntities()
			controlStore.updateFeedbackValues('conn', [
				{ entityId: localVariable.id, controlId: CALLER_CONTROL_ID, value: 7 },
			])
			await expectValue(callerEntity, true)

			controlStore.updateFeedbackValues('conn', [
				{ entityId: localVariable.id, controlId: CALLER_CONTROL_ID, value: 2 },
			])
			await expectValue(callerEntity, false)
		})

		test('follows the values of a connection feedback being cleared', async () => {
			const { createCaller, controlStore, customFeedbackInstances } = createHarness({
				feedbacks: [{ ...moduleValue('unused'), definitionId: 'is_on', variableName: undefined }],
			})

			const { caller, callerEntity } = createCaller(useFeedback())
			// Let the copy be rebuilt for the creation of the custom feedback, so that it is not replaced below
			await new Promise((resolve) => setTimeout(resolve, 150))
			const [connectionFeedback] = customFeedbackInstances.getHeldCopy(callerEntity)!.feedbacks.getDirectEntities()
			controlStore.updateFeedbackValues('conn', [
				{ entityId: connectionFeedback.id, controlId: CALLER_CONTROL_ID, value: true },
			])
			await expectValue(callerEntity, true)

			// eg the connection is disabled
			caller.entities.clearConnectionState('conn')
			await expectValue(callerEntity, false)
		})

		test('follows a change to the custom feedback', async () => {
			const { control, createCaller } = createHarness({ feedbacks: [check('true')] })

			const { callerEntity } = createCaller(useFeedback())
			await expectValue(callerEntity, true)

			control.entities.entityAdd('feedbacks', null, check('false'))
			await expectValue(callerEntity, false)
		})

		test('is false once the custom feedback is deleted', async () => {
			const { control, controlStore, createCaller } = createHarness({ feedbacks: [check('true')] })

			const { callerEntity } = createCaller(useFeedback())
			await expectValue(callerEntity, true)

			control.destroy()
			controlStore.controls.delete(CUSTOM_FEEDBACK_CONTROL_ID)
			await expectValue(callerEntity, false)
		})

		test('can use another custom feedback, with its own inputs', async () => {
			const { deps, controlStore, createCaller } = createHarness({
				feedbacks: [useFeedback({ n: { isExpression: true, value: '$(options:n) + 1' } }, 'inner')],
			})

			const inner = new ControlCustomFeedback(deps, CreateCustomFeedbackControlId('inner'), null, false)
			controlStore.controls.set(inner.controlId, inner)
			inner.inputAdd(numberInput)
			inner.entities.entityAdd('feedbacks', null, check('$(options:n) == 6'))

			const { callerEntity } = createCaller(useFeedback({ n: exprVal(5) }))
			await expectValue(callerEntity, true)
		})

		test('a module feedback in the copy is subscribed for the control of the caller', async () => {
			const { createCaller, processManager } = createHarness({
				feedbacks: [{ ...moduleValue('unused'), variableName: undefined }],
			})

			createCaller(useFeedback())

			await vi.waitFor(() =>
				expect(processManager.connectionEntityUpdate).toHaveBeenCalledWith(
					expect.objectContaining({ connectionId: 'conn' }),
					CALLER_CONTROL_ID
				)
			)
		})
	})

	describe('the copy held by a feedback using it', () => {
		test('is inactive while an input is invalid, and built once it becomes valid', async () => {
			const { deps, createCaller, customFeedbackInstances } = createHarness({ feedbacks: [check('true')] })

			deps.variableValues.setVariableValues('custom', [{ id: 'level', value: 'not a number' }])
			const { callerEntity } = createCaller(useFeedback({ n: exprExpr('$(custom:level)') }))
			await expectValue(callerEntity, false)
			expect(customFeedbackInstances.getHeldCopy(callerEntity)).toBeUndefined()

			deps.variableValues.setVariableValues('custom', [{ id: 'level', value: 5 }])
			await expectValue(callerEntity, true)
			expect(customFeedbackInstances.getHeldCopy(callerEntity)).toBeDefined()

			// And becomes inactive again
			deps.variableValues.setVariableValues('custom', [{ id: 'level', value: 'not a number' }])
			await expectValue(callerEntity, false)
			expect(customFeedbackInstances.getHeldCopy(callerEntity)).toBeUndefined()
		})

		test('is not held by a disabled feedback, nor subscribed', async () => {
			const { createCaller, customFeedbackInstances, processManager } = createHarness({
				feedbacks: [{ ...moduleValue('unused'), variableName: undefined }],
			})

			const { caller, callerEntity } = createCaller({ ...useFeedback(), disabled: true })
			// Let anything which would be built settle
			await new Promise((resolve) => setTimeout(resolve, 150))
			expect(customFeedbackInstances.getHeldCopy(callerEntity)).toBeUndefined()
			expect(processManager.connectionEntityUpdate).not.toHaveBeenCalledWith(
				expect.objectContaining({ connectionId: 'conn' }),
				CALLER_CONTROL_ID
			)

			caller.entities.entityEnabled('feedbacks', callerEntity.id, true)
			expect(customFeedbackInstances.getHeldCopy(callerEntity)).toBeDefined()

			caller.entities.entityEnabled('feedbacks', callerEntity.id, false)
			expect(customFeedbackInstances.getHeldCopy(callerEntity)).toBeUndefined()
		})

		test.each([
			['within the limit', MAX_CUSTOM_ACTION_DEPTH - 1, true],
			['beyond the limit', MAX_CUSTOM_ACTION_DEPTH, false],
		])('a chain of custom feedbacks using each other nested %s', async (_name, depth, expected) => {
			// The caller is itself a custom feedback, so starts the chain, and each in the chain uses the next. They are made
			// from the end, as a feedback can only be added once what it uses exists
			const { deps, control, controlStore, createCaller, customFeedbackInstances } = createHarness({ inputs: [] })
			for (let i = depth; i >= 2; i--) {
				const link = new ControlCustomFeedback(deps, CreateCustomFeedbackControlId(`chain-${i}`), null, false)
				controlStore.controls.set(link.controlId, link)
				link.entities.entityAdd('feedbacks', null, i < depth ? useFeedback({}, `chain-${i + 1}`) : check('true'))
			}
			control.entities.entityAdd('feedbacks', null, depth > 1 ? useFeedback({}, 'chain-2') : check('true'))

			const { callerEntity } = createCaller(useFeedback())
			if (expected) await expectValue(callerEntity, true)

			// Follow the copies down the chain, as far as they were built
			const countCopies = () => {
				let count = 0
				let copy = customFeedbackInstances.getHeldCopy(callerEntity)
				while (copy) {
					count++
					const [next] = copy.feedbacks.getDirectEntities()
					copy = next ? customFeedbackInstances.getHeldCopy(next) : undefined
				}
				return count
			}
			// The caller and each copy count towards the depth, so the copy which would reach it is refused
			await vi.waitFor(() => expect(countCopies()).toBe(Math.min(depth, MAX_CUSTOM_ACTION_DEPTH - 1)))
			expect(callerEntity.getBooleanFeedbackValue(null)).toBe(expected)
		})

		test('can start with the values of another copy with the same inputs, including those it uses', async () => {
			const { deps, controlStore, createCaller, customFeedbackInstances } = createHarness({
				feedbacks: [
					{ ...moduleValue('unused'), definitionId: 'is_on', variableName: undefined },
					useFeedback({}, 'inner'),
				],
			})
			const inner = new ControlCustomFeedback(deps, CreateCustomFeedbackControlId('inner'), null, false)
			controlStore.controls.set(inner.controlId, inner)
			inner.entities.entityAdd('feedbacks', null, {
				...moduleValue('unused'),
				definitionId: 'is_on',
				variableName: undefined,
			})

			const { caller, callerEntity: source } = createCaller(useFeedback({ n: exprVal(5) }))
			caller.entities.entityAdd('feedbacks', null, useFeedback({ n: exprVal(5) }))
			const target = caller.entities.getFeedbackEntities()[1]
			// Let the copies be rebuilt for the creation of the custom feedbacks, so that they are not replaced below
			await new Promise((resolve) => setTimeout(resolve, 150))

			// Only the source is given the values by the connection
			const sourceCopy = customFeedbackInstances.getHeldCopy(source)!
			const [sourceFeedback, sourceUse] = sourceCopy.feedbacks.getDirectEntities()
			const innerFeedback = customFeedbackInstances.getHeldCopy(sourceUse)!.feedbacks.getDirectEntities()[0]
			controlStore.updateFeedbackValues('conn', [
				{ entityId: sourceFeedback.id, controlId: CALLER_CONTROL_ID, value: true },
				{ entityId: innerFeedback.id, controlId: CALLER_CONTROL_ID, value: true },
			])
			await expectValue(source, true)
			expect(target.getBooleanFeedbackValue(null)).toBe(false)

			customFeedbackInstances.copyRuntimeValues(target, source)
			await expectValue(target, true)
		})

		test('does not start with the values of a copy with different inputs', async () => {
			const { controlStore, createCaller, customFeedbackInstances } = createHarness({
				feedbacks: [{ ...moduleValue('unused'), definitionId: 'is_on', variableName: undefined }],
			})

			const { caller, callerEntity: source } = createCaller(useFeedback({ n: exprVal(5) }))
			caller.entities.entityAdd('feedbacks', null, useFeedback({ n: exprVal(6) }))
			const target = caller.entities.getFeedbackEntities()[1]
			await new Promise((resolve) => setTimeout(resolve, 150))

			const [sourceFeedback] = customFeedbackInstances.getHeldCopy(source)!.feedbacks.getDirectEntities()
			controlStore.updateFeedbackValues('conn', [
				{ entityId: sourceFeedback.id, controlId: CALLER_CONTROL_ID, value: true },
			])
			await expectValue(source, true)

			customFeedbackInstances.copyRuntimeValues(target, source)
			await new Promise((resolve) => setTimeout(resolve, 20))
			expect(target.getBooleanFeedbackValue(null)).toBe(false)
		})
	})

	describe('inputs', () => {
		test('renaming an input renames the references to it, including in whether a feedback is inverted', async () => {
			const { control, createCaller } = createHarness({
				feedbacks: [{ ...check('$(options:n) == 5'), isInverted: exprExpr('$(options:n) != 5') }],
			})

			expect(control.inputUpdate('n', { ...numberInput, id: 'renamed' })).toBe(true)

			const [feedback] = control.entities.getFeedbackEntities()
			expect(feedback.rawOptions.expression).toEqual(exprVal('$(options:renamed) == 5'))
			expect(feedback.rawIsInverted).toEqual(exprExpr('$(options:renamed) != 5'))

			// And a use which gives the input under its new id sees it
			const { callerEntity } = createCaller(useFeedback({ renamed: exprVal(5) }))
			await expectValue(callerEntity, true)
		})

		test('the feedbacks which use it follow an input being renamed', async () => {
			const { control, controlStore, createCaller } = createHarness({ feedbacks: [check('$(options:n) == 5')] })

			const { callerEntity } = createCaller(useFeedback({ n: exprVal(5) }))
			await expectValue(callerEntity, true)

			control.inputUpdate('n', { ...numberInput, id: 'renamed' })
			renameBuildingBlockInputInCallers(controlStore, CUSTOM_FEEDBACK_CONTROL_ID, 'n', 'renamed')

			expect(callerEntity.rawOptions).toEqual({ renamed: exprVal(5) })
			await expectValue(callerEntity, true)
		})

		test('removing an input removes the value given for it by the feedbacks which use it', () => {
			const { control, controlStore, createCaller } = createHarness({ feedbacks: [check('true')] })

			const { callerEntity } = createCaller(useFeedback({ n: exprVal(5), other: exprVal(1) }))

			expect(control.inputRemove('n')).toBe(true)
			removeBuildingBlockInputInCallers(controlStore, CUSTOM_FEEDBACK_CONTROL_ID, 'n')

			expect(callerEntity.rawOptions).toEqual({ other: exprVal(1) })
		})

		test('the inputs of a use of another custom feedback are left alone', () => {
			const { deps, controlStore, createCaller } = createHarness({ feedbacks: [check('true')] })
			const other = new ControlCustomFeedback(deps, CreateCustomFeedbackControlId('other'), null, false)
			controlStore.controls.set(other.controlId, other)

			const { callerEntity } = createCaller(useFeedback({ n: exprVal(5) }, 'other'))

			renameBuildingBlockInputInCallers(controlStore, CUSTOM_FEEDBACK_CONTROL_ID, 'n', 'renamed')
			removeBuildingBlockInputInCallers(controlStore, CUSTOM_FEEDBACK_CONTROL_ID, 'n')

			expect(callerEntity.rawOptions).toEqual({ n: exprVal(5) })
		})
	})

	describe('evaluated as the condition of an action', () => {
		/** A context like the one an action gives the feedbacks it checks */
		function actionContext(
			variableValues: VariablesValues,
			variables: Record<string, any>,
			executionVariables: Record<string, any>
		): FeedbackExecutionContext {
			const parserOptions = { allowClockSensitive: false }
			const parser = variableValues.createVariablesAndExpressionParser(
				null,
				null,
				{ ...variables, ...executionVariables },
				null,
				parserOptions
			)
			return { parser, executionVariables, parserOptions }
		}

		test('parses its inputs in the context of the action, rather than using its cached value', async () => {
			const { deps, createCaller } = createHarness({ feedbacks: [check('$(options:n) > 4')] })

			// Outside of the action the variable has a value which makes it false
			deps.variableValues.setVariableValues('custom', [{ id: 'level', value: 1 }])
			const { callerEntity } = createCaller(useFeedback({ n: exprExpr('$(custom:level)') }))
			await expectValue(callerEntity, false)

			expect(callerEntity.getBooleanFeedbackValue(actionContext(deps.variableValues, { 'custom:level': 7 }, {}))).toBe(
				true
			)
			expect(callerEntity.getBooleanFeedbackValue(actionContext(deps.variableValues, { 'custom:level': 2 }, {}))).toBe(
				false
			)
		})

		test('passes on the this variables of the execution to its feedbacks', async () => {
			const { deps, createCaller } = createHarness({ feedbacks: [check("$(this:surface_id) == 'surface0'")] })

			const { callerEntity } = createCaller(useFeedback())
			await expectValue(callerEntity, false)

			const pressedBy = (surfaceId: string) => actionContext(deps.variableValues, {}, { 'this:surface_id': surfaceId })
			expect(callerEntity.getBooleanFeedbackValue(pressedBy('surface0'))).toBe(true)
			expect(callerEntity.getBooleanFeedbackValue(pressedBy('surface1'))).toBe(false)
		})

		test('passes them on to a custom feedback it uses, and its inputs', async () => {
			const { deps, controlStore, createCaller } = createHarness({
				feedbacks: [useFeedback({ n: exprExpr('$(options:n) + 1') }, 'inner')],
			})

			const inner = new ControlCustomFeedback(deps, CreateCustomFeedbackControlId('inner'), null, false)
			controlStore.controls.set(inner.controlId, inner)
			inner.inputAdd(numberInput)
			inner.entities.entityAdd('feedbacks', null, check("$(this:surface_id) == 'surface0' && $(options:n) == 6"))

			deps.variableValues.setVariableValues('custom', [{ id: 'level', value: 1 }])
			const { callerEntity } = createCaller(useFeedback({ n: exprExpr('$(custom:level)') }))
			await expectValue(callerEntity, false)

			const context = actionContext(deps.variableValues, { 'custom:level': 5 }, { 'this:surface_id': 'surface0' })
			expect(callerEntity.getBooleanFeedbackValue(context)).toBe(true)
		})

		test('an input which can only be parsed in the action is parsed there, though the feedback holds no copy', async () => {
			const { deps, createCaller, customFeedbackInstances } = createHarness({
				feedbacks: [check('$(options:n) > 4')],
			})

			// Outside of an action there is no delta, so the input is invalid and no copy is held
			const { caller, callerEntity } = createCaller(useFeedback({ n: exprExpr('$(this:delta)') }))
			await expectValue(callerEntity, false)
			expect(customFeedbackInstances.getHeldCopy(callerEntity)).toBeUndefined()

			expect(callerEntity.getBooleanFeedbackValue(actionContext(deps.variableValues, {}, { 'this:delta': 5 }))).toBe(
				true
			)
			expect(callerEntity.getBooleanFeedbackValue(actionContext(deps.variableValues, {}, { 'this:delta': 2 }))).toBe(
				false
			)

			// The copy made for the evaluation is gone again
			expect(caller.entities.getAllEntitiesWithTransient().some((entity) => entity.id.includes('@'))).toBe(false)
		})

		test('without a held copy, a custom feedback it uses sees the inputs from the action too', async () => {
			const { deps, controlStore, createCaller } = createHarness({
				feedbacks: [useFeedback({ n: exprExpr('$(options:n) + 1') }, 'inner')],
			})

			const inner = new ControlCustomFeedback(deps, CreateCustomFeedbackControlId('inner'), null, false)
			controlStore.controls.set(inner.controlId, inner)
			inner.inputAdd(numberInput)
			inner.entities.entityAdd('feedbacks', null, check('$(options:n) == 6'))

			const { callerEntity } = createCaller(useFeedback({ n: exprExpr('$(this:delta)') }))
			await expectValue(callerEntity, false)

			expect(callerEntity.getBooleanFeedbackValue(actionContext(deps.variableValues, {}, { 'this:delta': 5 }))).toBe(
				true
			)
		})

		test('sees the local variables of its copy, computed in the context', async () => {
			const { deps, createCaller } = createHarness({
				localVariables: [computedValue('double', '$(options:n) * 2')],
				feedbacks: [check('$(local:double) == 14')],
			})

			deps.variableValues.setVariableValues('custom', [{ id: 'level', value: 1 }])
			const { callerEntity } = createCaller(useFeedback({ n: exprExpr('$(custom:level)') }))
			await expectValue(callerEntity, false)

			expect(callerEntity.getBooleanFeedbackValue(actionContext(deps.variableValues, { 'custom:level': 7 }, {}))).toBe(
				true
			)
		})

		test('is inverted', async () => {
			const { deps, createCaller } = createHarness({ feedbacks: [check('true')] })

			const { callerEntity } = createCaller({ ...useFeedback(), isInverted: exprVal(true) })
			await expectValue(callerEntity, false)

			expect(callerEntity.getBooleanFeedbackValue(actionContext(deps.variableValues, {}, {}))).toBe(false)
		})
	})
})
