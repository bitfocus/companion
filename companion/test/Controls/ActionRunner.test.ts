import { describe, expect, test, vi } from 'vitest'
import { mock, mockDeep } from 'vitest-mock-extended'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { ActionRunner, ControlActionRunner } from '../../lib/Controls/ActionRunner.js'
import type { ControlEntityInstance } from '../../lib/Controls/Entities/EntityInstance.js'
import type { StoreResult } from '../../lib/Controls/Entities/Types.js'
import type { RunActionExtras } from '../../lib/Instance/Connection/ChildHandlerApi.js'
import type { InstanceController } from '../../lib/Instance/Controller.js'
import type { InternalController } from '../../lib/Internal/Controller.js'
import type { VariablesController } from '../../lib/Variables/Controller.js'
import type { LocalVariablesController } from '../../lib/Variables/LocalVariablesController.js'

let nextEntityId = 0

function fakeEntity(
	props: {
		connectionId?: string
		definitionId?: string
		type?: EntityModelType
		/** Type reported by asEntityModel, when it should differ from `type` */
		modelType?: EntityModelType
		disabled?: boolean
		storeResult?: StoreResult
	} = {}
): ControlEntityInstance {
	const id = `entity-${nextEntityId++}`
	const type = props.type ?? EntityModelType.Action
	const connectionId = props.connectionId ?? 'conn01'
	const definitionId = props.definitionId ?? 'test-action'

	return {
		id,
		type,
		disabled: props.disabled ?? false,
		connectionId,
		definitionId,
		storeResult: props.storeResult,
		asEntityModel: vi.fn(() => ({
			type: props.modelType ?? type,
			id,
			connectionId,
			definitionId,
			options: {},
		})),
	} as unknown as ControlEntityInstance
}

function makeExtras(overrides: Partial<RunActionExtras> = {}): { extras: RunActionExtras; abort: AbortController } {
	const abort = new AbortController()
	return {
		abort,
		extras: {
			controlId: 'control:test',
			surfaceId: undefined,
			location: { pageNumber: 2, row: 1, column: 3 },
			abortDelayed: abort.signal,
			executionMode: 'concurrent',
			...overrides,
		},
	}
}

function createRunner() {
	const instanceController = mockDeep<InstanceController>()
	const internalModule = mock<InternalController>()
	const variablesController = mockDeep<VariablesController>()
	const localVariablesController = mock<LocalVariablesController>()

	const runner = new ActionRunner(instanceController, internalModule, variablesController, localVariablesController)

	const actionRun = vi.fn(async (): Promise<any> => undefined)
	instanceController.processManager.getConnectionChild.mockReturnValue({ actionRun } as any)

	return { runner, instanceController, internalModule, variablesController, localVariablesController, actionRun }
}

function deferred<T = void>() {
	let resolve!: (value: T) => void
	let reject!: (err: unknown) => void
	const promise = new Promise<T>((res, rej) => {
		resolve = res
		reject = rej
	})
	return { promise, resolve, reject }
}

/** Flush all pending microtasks */
async function flush() {
	await new Promise((resolve) => setImmediate(resolve))
}

describe('ActionRunner', () => {
	describe('filtering', () => {
		test('does nothing with an empty list', async () => {
			const { runner, instanceController, internalModule } = createRunner()
			const { extras } = makeExtras()

			await runner.runMultipleActions([], extras)

			expect(instanceController.processManager.getConnectionChild).not.toHaveBeenCalled()
			expect(internalModule.executeAction).not.toHaveBeenCalled()
		})

		test('skips disabled actions and non-action entities', async () => {
			const { runner, actionRun } = createRunner()
			const { extras } = makeExtras()

			await runner.runMultipleActions(
				[fakeEntity({ disabled: true }), fakeEntity({ type: EntityModelType.Feedback })],
				extras
			)

			expect(actionRun).not.toHaveBeenCalled()
		})

		test('does nothing when already aborted', async () => {
			const { runner, actionRun } = createRunner()
			const { extras, abort } = makeExtras()
			abort.abort()

			await runner.runMultipleActions([fakeEntity()], extras)

			expect(actionRun).not.toHaveBeenCalled()
		})
	})

	describe('dispatch', () => {
		test('runs a connection action through the process manager', async () => {
			const { runner, instanceController, actionRun } = createRunner()
			const { extras } = makeExtras()
			const action = fakeEntity({ connectionId: 'conn01', definitionId: 'my-action' })

			await runner.runMultipleActions([action], extras)

			expect(instanceController.processManager.getConnectionChild).toHaveBeenCalledWith('conn01')
			expect(actionRun).toHaveBeenCalledTimes(1)
			expect(actionRun).toHaveBeenCalledWith(
				expect.objectContaining({ type: EntityModelType.Action, definitionId: 'my-action' }),
				extras
			)
		})

		test('runs an internal action through the internal module', async () => {
			const { runner, internalModule, actionRun } = createRunner()
			const { extras } = makeExtras()
			const action = fakeEntity({ connectionId: 'internal' })

			await runner.runMultipleActions([action], extras)

			expect(internalModule.executeAction).toHaveBeenCalledTimes(1)
			expect(internalModule.executeAction).toHaveBeenCalledWith(action, extras)
			expect(actionRun).not.toHaveBeenCalled()
		})

		test('resolves quietly when the connection is missing', async () => {
			const { runner, instanceController, actionRun } = createRunner()
			const { extras } = makeExtras()
			instanceController.processManager.getConnectionChild.mockReturnValue(undefined)

			await expect(runner.runMultipleActions([fakeEntity()], extras)).resolves.toBeUndefined()
			expect(actionRun).not.toHaveBeenCalled()
		})

		test('a rejecting action does not reject the chain', async () => {
			const { runner, actionRun } = createRunner()
			const { extras } = makeExtras()
			actionRun.mockRejectedValue(new Error('boom'))

			await expect(runner.runMultipleActions([fakeEntity()], extras)).resolves.toBeUndefined()
		})

		test('an entity whose model is not an action is not executed', async () => {
			const { runner, internalModule, actionRun } = createRunner()
			const { extras } = makeExtras()
			const action = fakeEntity({ modelType: EntityModelType.Feedback })
			const internalAction = fakeEntity({ connectionId: 'internal', modelType: EntityModelType.Feedback })

			await expect(runner.runMultipleActions([action, internalAction], extras)).resolves.toBeUndefined()
			expect(actionRun).not.toHaveBeenCalled()
			expect(internalModule.executeAction).not.toHaveBeenCalled()
		})
	})

	describe('concurrent execution', () => {
		test('starts all actions without waiting for each other', async () => {
			const { runner, actionRun } = createRunner()
			const { extras } = makeExtras()
			const first = deferred()
			const second = deferred()
			actionRun.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

			let settled = false
			const p = runner.runMultipleActions([fakeEntity(), fakeEntity()], extras).then(() => {
				settled = true
			})
			await flush()

			expect(actionRun).toHaveBeenCalledTimes(2)
			expect(settled).toBe(false)

			first.resolve()
			await flush()
			expect(settled).toBe(false)

			second.resolve()
			await p
		})

		test('a wait action acts as a barrier for the actions after it', async () => {
			const { runner, internalModule, actionRun } = createRunner()
			const { extras } = makeExtras()
			const waitPromise = deferred<undefined>()
			internalModule.executeAction.mockReturnValue(waitPromise.promise)

			const before = fakeEntity()
			const wait = fakeEntity({ connectionId: 'internal', definitionId: 'wait' })
			const after = fakeEntity()

			const p = runner.runMultipleActions([before, wait, after], extras)
			await flush()

			// The action before the wait and the wait itself start immediately, the one after does not
			expect(actionRun).toHaveBeenCalledTimes(1)
			expect(internalModule.executeAction).toHaveBeenCalledTimes(1)

			waitPromise.resolve(undefined)
			await flush()
			expect(actionRun).toHaveBeenCalledTimes(2)

			await p
		})

		test('waits are only detected for the internal wait action', async () => {
			const { runner, actionRun } = createRunner()
			const { extras } = makeExtras()
			const first = deferred()
			actionRun.mockReturnValueOnce(first.promise as any).mockResolvedValue(undefined)

			// A connection action called 'wait' is not a barrier
			const p = runner.runMultipleActions([fakeEntity({ definitionId: 'wait' }), fakeEntity()], extras)
			await flush()

			expect(actionRun).toHaveBeenCalledTimes(2)

			first.resolve()
			await p
		})

		test('aborting during a wait prevents the actions after it', async () => {
			const { runner, internalModule, actionRun } = createRunner()
			const { extras, abort } = makeExtras()
			const waitPromise = deferred<undefined>()
			internalModule.executeAction.mockReturnValue(waitPromise.promise)

			const wait = fakeEntity({ connectionId: 'internal', definitionId: 'wait' })

			const p = runner.runMultipleActions([fakeEntity(), wait, fakeEntity()], extras)
			await flush()
			expect(actionRun).toHaveBeenCalledTimes(1)

			abort.abort()
			waitPromise.resolve(undefined)
			await p

			expect(actionRun).toHaveBeenCalledTimes(1)
		})

		test('a failing wait action does not prevent the actions after it', async () => {
			const { runner, internalModule, actionRun } = createRunner()
			const { extras } = makeExtras()
			internalModule.executeAction.mockRejectedValue(new Error('wait failed'))

			const wait = fakeEntity({ connectionId: 'internal', definitionId: 'wait' })

			await runner.runMultipleActions([wait, fakeEntity()], extras)

			expect(actionRun).toHaveBeenCalledTimes(1)
		})

		test('multiple waits produce multiple barriers', async () => {
			const { runner, internalModule, actionRun } = createRunner()
			const { extras } = makeExtras()
			const wait1 = deferred<undefined>()
			const wait2 = deferred<undefined>()
			internalModule.executeAction.mockReturnValueOnce(wait1.promise).mockReturnValueOnce(wait2.promise)

			const actions = [
				fakeEntity({ connectionId: 'internal', definitionId: 'wait' }),
				fakeEntity(),
				fakeEntity({ connectionId: 'internal', definitionId: 'wait' }),
				fakeEntity(),
			]

			const p = runner.runMultipleActions(actions, extras)
			await flush()
			expect(actionRun).toHaveBeenCalledTimes(0)

			wait1.resolve(undefined)
			await flush()
			expect(actionRun).toHaveBeenCalledTimes(1)

			wait2.resolve(undefined)
			await flush()
			expect(actionRun).toHaveBeenCalledTimes(2)

			await p
		})
	})

	describe('sequential execution', () => {
		test('runs actions one at a time in order', async () => {
			const { runner, actionRun } = createRunner()
			const { extras } = makeExtras()
			const first = deferred()
			const second = deferred()
			actionRun.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

			const p = runner.runMultipleActions([fakeEntity(), fakeEntity()], extras, true)
			await flush()
			expect(actionRun).toHaveBeenCalledTimes(1)

			first.resolve()
			await flush()
			expect(actionRun).toHaveBeenCalledTimes(2)

			second.resolve()
			await p
		})

		test('stops when aborted between actions', async () => {
			const { runner, actionRun } = createRunner()
			const { extras, abort } = makeExtras()
			const first = deferred()
			actionRun.mockReturnValueOnce(first.promise)

			const p = runner.runMultipleActions([fakeEntity(), fakeEntity()], extras, true)
			await flush()
			expect(actionRun).toHaveBeenCalledTimes(1)

			abort.abort()
			first.resolve()
			await p

			expect(actionRun).toHaveBeenCalledTimes(1)
		})

		test('continues after an action fails', async () => {
			const { runner, actionRun } = createRunner()
			const { extras } = makeExtras()
			actionRun.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(undefined)

			await runner.runMultipleActions([fakeEntity(), fakeEntity()], extras, true)

			expect(actionRun).toHaveBeenCalledTimes(2)
		})
	})

	describe('storeResult', () => {
		test('stores a connection action result into a local variable', async () => {
			const { runner, actionRun, localVariablesController } = createRunner()
			const { extras } = makeExtras()
			actionRun.mockResolvedValue('the-result')
			const targetVariable = { controlId: 'control:target', name: 'myvar' }
			localVariablesController.localVariableFor.mockReturnValue(targetVariable)

			const action = fakeEntity({
				storeResult: { type: 'local-variable', location: '1/0/0', variableName: 'myvar' },
			})
			await runner.runMultipleActions([action], extras)

			expect(localVariablesController.localVariableFor).toHaveBeenCalledWith('1/0/0', 'myvar', extras)
			expect(localVariablesController.setLocalVariable).toHaveBeenCalledWith(targetVariable, 'the-result')
		})

		test('stores an internal action result', async () => {
			const { runner, internalModule, localVariablesController } = createRunner()
			const { extras } = makeExtras()
			internalModule.executeAction.mockResolvedValue('internal-result')
			const targetVariable = { controlId: 'control:target', name: 'myvar' }
			localVariablesController.localVariableFor.mockReturnValue(targetVariable)

			const action = fakeEntity({
				connectionId: 'internal',
				storeResult: { type: 'local-variable', location: 'this', variableName: 'myvar' },
			})
			await runner.runMultipleActions([action], extras)

			expect(localVariablesController.setLocalVariable).toHaveBeenCalledWith(targetVariable, 'internal-result')
		})

		test('does not store when the local variable is invalid', async () => {
			const { runner, actionRun, localVariablesController } = createRunner()
			const { extras } = makeExtras()
			actionRun.mockResolvedValue('the-result')
			localVariablesController.localVariableFor.mockReturnValue(null)

			const action = fakeEntity({
				storeResult: { type: 'local-variable', location: 'nonsense', variableName: 'myvar' },
			})
			await runner.runMultipleActions([action], extras)

			expect(localVariablesController.setLocalVariable).not.toHaveBeenCalled()
		})

		test('does not store when the connection is missing', async () => {
			const { runner, instanceController, localVariablesController } = createRunner()
			const { extras } = makeExtras()
			instanceController.processManager.getConnectionChild.mockReturnValue(undefined)

			const action = fakeEntity({
				storeResult: { type: 'local-variable', location: 'this', variableName: 'myvar' },
			})
			await runner.runMultipleActions([action], extras)

			expect(localVariablesController.localVariableFor).not.toHaveBeenCalled()
			expect(localVariablesController.setLocalVariable).not.toHaveBeenCalled()
		})

		test('does not store when the chain is aborted while the action runs', async () => {
			const { runner, actionRun, localVariablesController } = createRunner()
			const { extras, abort } = makeExtras()
			const running = deferred<string>()
			actionRun.mockReturnValue(running.promise)

			const action = fakeEntity({
				storeResult: { type: 'local-variable', location: 'this', variableName: 'myvar' },
			})
			const p = runner.runMultipleActions([action], extras)
			await flush()

			abort.abort()
			running.resolve('the-result')
			await p

			expect(localVariablesController.localVariableFor).not.toHaveBeenCalled()
			expect(localVariablesController.setLocalVariable).not.toHaveBeenCalled()
		})

		test('stores into a page variable using the current page', async () => {
			const { runner, actionRun, localVariablesController } = createRunner()
			const { extras } = makeExtras()
			actionRun.mockResolvedValue('page-result')
			const targetVariable = { controlId: 'page:abc', name: 'pv' }
			localVariablesController.pageVariableFor.mockReturnValue(targetVariable)

			const action = fakeEntity({
				storeResult: { type: 'page-variable', page: '4', variableName: 'pv' },
			})
			await runner.runMultipleActions([action], extras)

			expect(localVariablesController.pageVariableFor).toHaveBeenCalledWith('4', 'pv', extras.location?.pageNumber)
			expect(localVariablesController.setLocalVariable).toHaveBeenCalledWith(targetVariable, 'page-result')
		})

		test('page variable resolves with null page when the control has no location', async () => {
			const { runner, actionRun, localVariablesController } = createRunner()
			const { extras } = makeExtras({ location: undefined })
			actionRun.mockResolvedValue('page-result')
			localVariablesController.pageVariableFor.mockReturnValue(null)

			const action = fakeEntity({
				storeResult: { type: 'page-variable', page: '0', variableName: 'pv' },
			})
			await runner.runMultipleActions([action], extras)

			expect(localVariablesController.pageVariableFor).toHaveBeenCalledWith('0', 'pv', null)
			expect(localVariablesController.setLocalVariable).not.toHaveBeenCalled()
		})

		test('stores into an existing custom variable', async () => {
			const { runner, actionRun, variablesController } = createRunner()
			const { extras } = makeExtras()
			actionRun.mockResolvedValue('custom-result')
			variablesController.custom.hasCustomVariable.mockReturnValue(true)

			const action = fakeEntity({
				storeResult: { type: 'custom-variable', variableName: 'cv', createIfNotExists: false },
			})
			await runner.runMultipleActions([action], extras)

			expect(variablesController.custom.setValue).toHaveBeenCalledWith('cv', 'custom-result')
			expect(variablesController.custom.createVariable).not.toHaveBeenCalled()
		})

		test('creates a missing custom variable when createIfNotExists is set', async () => {
			const { runner, actionRun, variablesController } = createRunner()
			const { extras } = makeExtras()
			actionRun.mockResolvedValue('custom-result')
			variablesController.custom.hasCustomVariable.mockReturnValue(false)

			const action = fakeEntity({
				storeResult: { type: 'custom-variable', variableName: 'cv', createIfNotExists: true },
			})
			await runner.runMultipleActions([action], extras)

			expect(variablesController.custom.createVariable).toHaveBeenCalledWith('cv', 'custom-result')
			expect(variablesController.custom.setValue).not.toHaveBeenCalled()
		})

		test('does not create a missing custom variable without createIfNotExists', async () => {
			const { runner, actionRun, variablesController } = createRunner()
			const { extras } = makeExtras()
			actionRun.mockResolvedValue('custom-result')
			variablesController.custom.hasCustomVariable.mockReturnValue(false)

			const action = fakeEntity({
				storeResult: { type: 'custom-variable', variableName: 'cv', createIfNotExists: false },
			})
			await runner.runMultipleActions([action], extras)

			expect(variablesController.custom.setValue).not.toHaveBeenCalled()
			expect(variablesController.custom.createVariable).not.toHaveBeenCalled()
		})

		test('ignores a custom variable target with an empty name', async () => {
			const { runner, actionRun, variablesController } = createRunner()
			const { extras } = makeExtras()
			actionRun.mockResolvedValue('custom-result')

			const action = fakeEntity({
				storeResult: { type: 'custom-variable', variableName: '', createIfNotExists: true },
			})
			await runner.runMultipleActions([action], extras)

			expect(variablesController.custom.hasCustomVariable).not.toHaveBeenCalled()
			expect(variablesController.custom.createVariable).not.toHaveBeenCalled()
		})

		test('stores an undefined result', async () => {
			const { runner, actionRun, localVariablesController } = createRunner()
			const { extras } = makeExtras()
			actionRun.mockResolvedValue(undefined)
			const targetVariable = { controlId: 'control:target', name: 'myvar' }
			localVariablesController.localVariableFor.mockReturnValue(targetVariable)

			const action = fakeEntity({
				storeResult: { type: 'local-variable', location: 'this', variableName: 'myvar' },
			})
			await runner.runMultipleActions([action], extras)

			expect(localVariablesController.setLocalVariable).toHaveBeenCalledWith(targetVariable, undefined)
		})
	})
})

describe('ControlActionRunner', () => {
	function createControlRunner() {
		const actionRunner = mock<ActionRunner>()
		actionRunner.runMultipleActions.mockResolvedValue(undefined)
		const triggerRedraw = vi.fn()
		const controlRunner = new ControlActionRunner(actionRunner, 'control:abc', triggerRedraw)
		return { actionRunner, triggerRedraw, controlRunner }
	}

	function runActionsExtras() {
		return {
			surfaceId: 'surface0',
			location: { pageNumber: 1, row: 2, column: 3 },
		}
	}

	/** The extras that runActions passed through to the wrapped ActionRunner for call n */
	function passedExtras(actionRunner: ReturnType<typeof createControlRunner>['actionRunner'], call = 0) {
		return actionRunner.runMultipleActions.mock.calls[call][1]
	}

	test('passes the control id, concurrent mode and an abort signal', async () => {
		const { actionRunner, controlRunner } = createControlRunner()
		const actions = [fakeEntity()]

		await controlRunner.runActions(actions, runActionsExtras())

		expect(actionRunner.runMultipleActions).toHaveBeenCalledTimes(1)
		expect(actionRunner.runMultipleActions).toHaveBeenCalledWith(actions, {
			controlId: 'control:abc',
			surfaceId: 'surface0',
			location: { pageNumber: 1, row: 2, column: 3 },
			executionMode: 'concurrent',
			abortDelayed: expect.any(AbortSignal),
		})
	})

	test('redraws when the first chain starts and the last one finishes', async () => {
		const { actionRunner, triggerRedraw, controlRunner } = createControlRunner()
		const first = deferred<void>()
		const second = deferred<void>()
		actionRunner.runMultipleActions.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

		const p1 = controlRunner.runActions([fakeEntity()], runActionsExtras())
		expect(controlRunner.hasRunningChains).toBe(true)
		expect(triggerRedraw).toHaveBeenCalledTimes(1)

		const p2 = controlRunner.runActions([fakeEntity()], runActionsExtras())
		expect(triggerRedraw).toHaveBeenCalledTimes(1)

		first.resolve()
		await p1
		expect(controlRunner.hasRunningChains).toBe(true)
		expect(triggerRedraw).toHaveBeenCalledTimes(1)

		second.resolve()
		await p2
		expect(controlRunner.hasRunningChains).toBe(false)
		expect(triggerRedraw).toHaveBeenCalledTimes(2)
	})

	test('propagates a chain failure but still cleans up', async () => {
		const { actionRunner, triggerRedraw, controlRunner } = createControlRunner()
		actionRunner.runMultipleActions.mockRejectedValue(new Error('boom'))

		await expect(controlRunner.runActions([fakeEntity()], runActionsExtras())).rejects.toThrow('boom')

		expect(controlRunner.hasRunningChains).toBe(false)
		expect(triggerRedraw).toHaveBeenCalledTimes(2)
	})

	describe('abortAll', () => {
		test('returns false with no running chains', () => {
			const { triggerRedraw, controlRunner } = createControlRunner()

			expect(controlRunner.abortAll(null)).toBe(false)
			expect(triggerRedraw).not.toHaveBeenCalled()
		})

		test('aborts every chain', async () => {
			const { actionRunner, controlRunner } = createControlRunner()
			const running = deferred<void>()
			actionRunner.runMultipleActions.mockReturnValue(running.promise)

			const p1 = controlRunner.runActions([fakeEntity()], runActionsExtras())
			const p2 = controlRunner.runActions([fakeEntity()], runActionsExtras())

			expect(controlRunner.abortAll(null)).toBe(true)

			expect(passedExtras(actionRunner, 0).abortDelayed.aborted).toBe(true)
			expect(passedExtras(actionRunner, 1).abortDelayed.aborted).toBe(true)
			expect(controlRunner.hasRunningChains).toBe(false)

			running.resolve()
			await Promise.all([p1, p2])
		})

		test('skips the excepted signal', async () => {
			const { actionRunner, controlRunner } = createControlRunner()
			const running = deferred<void>()
			actionRunner.runMultipleActions.mockReturnValue(running.promise)

			const p1 = controlRunner.runActions([fakeEntity()], runActionsExtras())
			const p2 = controlRunner.runActions([fakeEntity()], runActionsExtras())

			const keptSignal = passedExtras(actionRunner, 0).abortDelayed
			expect(controlRunner.abortAll(keptSignal)).toBe(true)

			expect(keptSignal.aborted).toBe(false)
			expect(passedExtras(actionRunner, 1).abortDelayed.aborted).toBe(true)
			expect(controlRunner.hasRunningChains).toBe(true)

			running.resolve()
			await Promise.all([p1, p2])
		})

		test('returns false and does not redraw when the only chain is excepted', async () => {
			const { actionRunner, triggerRedraw, controlRunner } = createControlRunner()
			const running = deferred<void>()
			actionRunner.runMultipleActions.mockReturnValue(running.promise)

			const p1 = controlRunner.runActions([fakeEntity()], runActionsExtras())
			expect(triggerRedraw).toHaveBeenCalledTimes(1)

			const keptSignal = passedExtras(actionRunner, 0).abortDelayed
			expect(controlRunner.abortAll(keptSignal)).toBe(false)

			expect(keptSignal.aborted).toBe(false)
			expect(controlRunner.hasRunningChains).toBe(true)
			expect(triggerRedraw).toHaveBeenCalledTimes(1)

			running.resolve()
			await p1
		})

		test('does not redraw again when an aborted chain finishes', async () => {
			const { actionRunner, triggerRedraw, controlRunner } = createControlRunner()
			const running = deferred<void>()
			actionRunner.runMultipleActions.mockReturnValue(running.promise)

			const p1 = controlRunner.runActions([fakeEntity()], runActionsExtras())
			controlRunner.abortAll(null)
			expect(triggerRedraw).toHaveBeenCalledTimes(2)

			running.resolve()
			await p1
			expect(triggerRedraw).toHaveBeenCalledTimes(2)
		})
	})

	describe('abortSingle', () => {
		test('returns false with no running chains', () => {
			const { controlRunner } = createControlRunner()

			expect(controlRunner.abortSingle(new AbortController().signal)).toBe(false)
		})

		test('aborts only the chain with the matching signal', async () => {
			const { actionRunner, controlRunner } = createControlRunner()
			const running = deferred<void>()
			actionRunner.runMultipleActions.mockReturnValue(running.promise)

			const p1 = controlRunner.runActions([fakeEntity()], runActionsExtras())
			const p2 = controlRunner.runActions([fakeEntity()], runActionsExtras())

			const targetSignal = passedExtras(actionRunner, 0).abortDelayed
			expect(controlRunner.abortSingle(targetSignal)).toBe(true)

			expect(targetSignal.aborted).toBe(true)
			expect(passedExtras(actionRunner, 1).abortDelayed.aborted).toBe(false)
			expect(controlRunner.hasRunningChains).toBe(true)

			running.resolve()
			await Promise.all([p1, p2])
		})

		test('returns false and does not redraw when no chain matches', async () => {
			const { actionRunner, triggerRedraw, controlRunner } = createControlRunner()
			const running = deferred<void>()
			actionRunner.runMultipleActions.mockReturnValue(running.promise)

			const p1 = controlRunner.runActions([fakeEntity()], runActionsExtras())
			expect(triggerRedraw).toHaveBeenCalledTimes(1)

			expect(controlRunner.abortSingle(new AbortController().signal)).toBe(false)

			expect(passedExtras(actionRunner, 0).abortDelayed.aborted).toBe(false)
			expect(controlRunner.hasRunningChains).toBe(true)
			expect(triggerRedraw).toHaveBeenCalledTimes(1)

			running.resolve()
			await p1
		})
	})
})
