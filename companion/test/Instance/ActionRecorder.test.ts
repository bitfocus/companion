import { initTRPC } from '@trpc/server'
import { describe, expect, test, vi } from 'vitest'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { ActionRecorder } from '../../lib/Instance/ActionRecorder.js'
import type { TrpcContext } from '../../lib/UI/TRPC.js'
import { createMockTrpcContext } from '../Util.js'
import { SubscriptionTester } from '../utils/SubscriptionTester.js'

const t = initTRPC.context<TrpcContext>().create()
const testCtx: TrpcContext = createMockTrpcContext()

function createRecorder(validConnectionIds: string[] = ['conn1', 'conn2']) {
	const connectionChildren = new Map<string, { startStopRecordingActions: ReturnType<typeof vi.fn> }>()
	const instanceController = {
		getAllConnectionIds: vi.fn(() => validConnectionIds),
		getInstanceConfigOfType: vi.fn(() => ({ lastUpgradeIndex: 7 })),
		processManager: {
			getConnectionChild: vi.fn((id: string) => connectionChildren.get(id)),
		},
	}

	const controls: Record<string, any> = {}
	const controlStore = {
		getControl: vi.fn((id: string) => controls[id]),
	}

	const recorder = new ActionRecorder(instanceController as any, controlStore as any)
	const caller = t.createCallerFactory(recorder.createTrpcRouter())(testCtx)

	return {
		recorder,
		caller,
		instanceController,
		controls,
		addConnectionChild(id: string) {
			const child = { startStopRecordingActions: vi.fn().mockResolvedValue(undefined) }
			connectionChildren.set(id, child)
			return child
		},
	}
}

function makeEntityControl() {
	return {
		supportsEntities: true,
		entities: {
			isEditable: true,
			entityAdd: vi.fn(() => true),
			entityReplaceAll: vi.fn(() => true),
		},
	}
}

describe('ActionRecorder', () => {
	test('starts with an empty, stopped session', () => {
		const { recorder } = createRecorder()

		const session = recorder.getSession()
		expect(session.id).toBeTruthy()
		expect(session.connectionIds).toEqual([])
		expect(session.isRunning).toBe(false)
		expect(session.actions).toEqual([])
	})

	describe('setSelectedConnectionIds', () => {
		test('filters out unknown connections', () => {
			const { recorder } = createRecorder(['conn1'])

			recorder.setSelectedConnectionIds(['conn1', 'unknown'])

			expect(recorder.getSession().connectionIds).toEqual(['conn1'])
		})

		test('rejects a non-array', () => {
			const { recorder } = createRecorder()

			expect(() => recorder.setSelectedConnectionIds('conn1' as any)).toThrow()
		})

		test('while running, connections are told to start and stop recording', () => {
			const { recorder, addConnectionChild } = createRecorder()
			const conn1 = addConnectionChild('conn1')

			recorder.setRecording(true)
			recorder.setSelectedConnectionIds(['conn1'])
			expect(conn1.startStopRecordingActions).toHaveBeenCalledWith(true)

			recorder.setSelectedConnectionIds([])
			expect(conn1.startStopRecordingActions).toHaveBeenCalledWith(false)
		})
	})

	describe('setRecording', () => {
		test('updates the session and emits', () => {
			const { recorder } = createRecorder()
			const isRunningListener = vi.fn()
			recorder.on('action_recorder_is_running', isRunningListener)

			recorder.setRecording(true)
			expect(recorder.getSession().isRunning).toBe(true)
			expect(isRunningListener).toHaveBeenCalledWith(true)

			recorder.setRecording(false)
			expect(recorder.getSession().isRunning).toBe(false)
			expect(isRunningListener).toHaveBeenCalledWith(false)
		})

		test('starting tells the selected connections to record', () => {
			const { recorder, addConnectionChild } = createRecorder()
			const conn1 = addConnectionChild('conn1')
			recorder.setSelectedConnectionIds(['conn1'])
			expect(conn1.startStopRecordingActions).not.toHaveBeenCalled()

			recorder.setRecording(true)
			expect(conn1.startStopRecordingActions).toHaveBeenCalledWith(true)

			recorder.setRecording(false)
			expect(conn1.startStopRecordingActions).toHaveBeenCalledWith(false)
		})

		test('a connection without a running child is skipped', () => {
			const { recorder } = createRecorder()
			recorder.setSelectedConnectionIds(['conn1'])

			expect(() => recorder.setRecording(true)).not.toThrow()
		})
	})

	describe('receiveAction', () => {
		test('ignores actions from unselected connections', () => {
			const { recorder } = createRecorder()

			recorder.receiveAction('conn1', 'act1', { foo: 'bar' }, 0, undefined)

			expect(recorder.getSession().actions).toEqual([])
		})

		test('records an action with converted options and upgrade index', () => {
			const { recorder } = createRecorder()
			recorder.setSelectedConnectionIds(['conn1'])

			recorder.receiveAction('conn1', 'act1', { foo: 'bar' }, 0, undefined)

			expect(recorder.getSession().actions).toEqual([
				{
					type: EntityModelType.Action,
					id: expect.any(String),
					connectionId: 'conn1',
					definitionId: 'act1',
					options: { foo: { value: 'bar', isExpression: false } },
					uniquenessId: undefined,
					upgradeIndex: 7,
				},
			])
		})

		test('a delay inserts a wait action before the action', () => {
			const { recorder } = createRecorder()
			recorder.setSelectedConnectionIds(['conn1'])

			recorder.receiveAction('conn1', 'act1', {}, 250, undefined)

			const actions = recorder.getSession().actions
			expect(actions).toHaveLength(2)
			expect(actions[0]).toMatchObject({
				connectionId: 'internal',
				definitionId: 'wait',
				options: { time: { isExpression: true, value: '250' } },
			})
			expect(actions[1]).toMatchObject({ definitionId: 'act1' })
		})

		test('a matching uniquenessId replaces the existing action', () => {
			const { recorder } = createRecorder()
			recorder.setSelectedConnectionIds(['conn1'])

			recorder.receiveAction('conn1', 'act1', { value: 1 }, 0, 'u1')
			recorder.receiveAction('conn1', 'act1', { value: 2 }, 0, 'u1')

			const actions = recorder.getSession().actions
			expect(actions).toHaveLength(1)
			expect(actions[0].options).toEqual({ value: { value: 2, isExpression: false } })
		})

		test('replacing an action updates its preceding wait', () => {
			const { recorder } = createRecorder()
			recorder.setSelectedConnectionIds(['conn1'])

			recorder.receiveAction('conn1', 'act1', { value: 1 }, 100, 'u1')
			recorder.receiveAction('conn1', 'act1', { value: 2 }, 300, 'u1')

			const actions = recorder.getSession().actions
			expect(actions).toHaveLength(2)
			expect(actions[0]).toMatchObject({
				definitionId: 'wait',
				options: { time: { isExpression: true, value: '300' } },
			})
			expect(actions[1].options).toEqual({ value: { value: 2, isExpression: false } })
		})

		test('replacing an action without a wait gains one if a delay is set', () => {
			const { recorder } = createRecorder()
			recorder.setSelectedConnectionIds(['conn1'])

			recorder.receiveAction('conn1', 'act1', { value: 1 }, 0, 'u1')
			recorder.receiveAction('conn1', 'act1', { value: 2 }, 200, 'u1')

			const actions = recorder.getSession().actions
			expect(actions).toHaveLength(2)
			expect(actions[0]).toMatchObject({ definitionId: 'wait' })
		})

		test('different uniquenessIds append separately', () => {
			const { recorder } = createRecorder()
			recorder.setSelectedConnectionIds(['conn1'])

			recorder.receiveAction('conn1', 'act1', {}, 0, 'u1')
			recorder.receiveAction('conn1', 'act2', {}, 0, 'u2')

			expect(recorder.getSession().actions).toHaveLength(2)
		})

		test('actions without a uniquenessId never merge', () => {
			const { recorder } = createRecorder()
			recorder.setSelectedConnectionIds(['conn1'])

			recorder.receiveAction('conn1', 'act1', {}, 0, undefined)
			recorder.receiveAction('conn1', 'act1', {}, 0, undefined)

			expect(recorder.getSession().actions).toHaveLength(2)
		})
	})

	describe('discardActions', () => {
		test('clears the actions but keeps the session', () => {
			const { recorder } = createRecorder()
			recorder.setSelectedConnectionIds(['conn1'])
			recorder.receiveAction('conn1', 'act1', {}, 0, undefined)
			const sessionId = recorder.getSession().id

			recorder.discardActions()

			const session = recorder.getSession()
			expect(session.id).toBe(sessionId)
			expect(session.actions).toEqual([])
			expect(session.connectionIds).toEqual(['conn1'])
		})
	})

	describe('destroySession', () => {
		test('replaces the session and stops recording', () => {
			const { recorder, addConnectionChild } = createRecorder()
			const conn1 = addConnectionChild('conn1')
			recorder.setSelectedConnectionIds(['conn1'])
			recorder.setRecording(true)
			recorder.receiveAction('conn1', 'act1', {}, 0, undefined)
			const oldId = recorder.getSession().id

			const isRunningListener = vi.fn()
			recorder.on('action_recorder_is_running', isRunningListener)

			recorder.destroySession()

			const session = recorder.getSession()
			expect(session.id).not.toBe(oldId)
			expect(session.isRunning).toBe(false)
			expect(session.actions).toEqual([])
			expect(session.connectionIds).toEqual([])
			expect(isRunningListener).toHaveBeenCalledWith(false)
			expect(conn1.startStopRecordingActions).toHaveBeenLastCalledWith(false)
		})

		test('can preserve the selected connections', () => {
			const { recorder } = createRecorder()
			recorder.setSelectedConnectionIds(['conn1'])

			recorder.destroySession(true)

			expect(recorder.getSession().connectionIds).toEqual(['conn1'])
		})
	})

	describe('connectionAvailabilityChange', () => {
		test('a stopped connection is removed from the session', () => {
			const { recorder } = createRecorder()
			recorder.setSelectedConnectionIds(['conn1', 'conn2'])

			recorder.connectionAvailabilityChange('conn1', false)

			expect(recorder.getSession().connectionIds).toEqual(['conn2'])
		})

		test('a started or unrelated connection changes nothing', () => {
			const { recorder } = createRecorder()
			recorder.setSelectedConnectionIds(['conn1'])
			const sessionsChanged = vi.fn()
			recorder.on('sessions_changed', sessionsChanged)

			recorder.connectionAvailabilityChange('conn1', true)
			recorder.connectionAvailabilityChange('unrelated', false)

			expect(recorder.getSession().connectionIds).toEqual(['conn1'])
			expect(sessionsChanged).not.toHaveBeenCalled()
		})
	})

	describe('saveToControlId', () => {
		test('append mode adds the actions to the control', () => {
			const { recorder, controls } = createRecorder()
			const control = makeEntityControl()
			controls['control1'] = control
			recorder.setSelectedConnectionIds(['conn1'])
			recorder.receiveAction('conn1', 'act1', {}, 0, undefined)
			const actions = recorder.getSession().actions
			const oldId = recorder.getSession().id

			recorder.saveToControlId('control1', 'step1', 'down', 'append')

			expect(control.entities.entityAdd).toHaveBeenCalledWith({ stepId: 'step1', setId: 'down' }, null, ...actions)

			// The session is replaced, preserving the connections
			const session = recorder.getSession()
			expect(session.id).not.toBe(oldId)
			expect(session.actions).toEqual([])
			expect(session.connectionIds).toEqual(['conn1'])
		})

		test('replace mode replaces the actions on the control', () => {
			const { recorder, controls } = createRecorder()
			const control = makeEntityControl()
			controls['control1'] = control
			recorder.setSelectedConnectionIds(['conn1'])
			recorder.receiveAction('conn1', 'act1', {}, 0, undefined)
			const actions = recorder.getSession().actions

			recorder.saveToControlId('control1', 'step1', 0, 'replace')

			expect(control.entities.entityReplaceAll).toHaveBeenCalledWith({ stepId: 'step1', setId: 0 }, actions)
		})

		test('failures throw without destroying the session', () => {
			const { recorder, controls } = createRecorder()
			const sessionId = recorder.getSession().id

			expect(() => recorder.saveToControlId('control1', 'step1', 'down', 'bad' as any)).toThrow(/Invalid mode/)
			expect(() => recorder.saveToControlId('missing', 'step1', 'down', 'append')).toThrow(/Unknown control/)

			controls['no-entities'] = { supportsEntities: false }
			expect(() => recorder.saveToControlId('no-entities', 'step1', 'down', 'append')).toThrow(/Not supported/)
			expect(() => recorder.saveToControlId('no-entities', 'step1', 'down', 'replace')).toThrow(/Not supported/)

			const rejecting = makeEntityControl()
			rejecting.entities.entityAdd.mockReturnValue(false)
			rejecting.entities.entityReplaceAll.mockReturnValue(false)
			controls['rejecting'] = rejecting
			expect(() => recorder.saveToControlId('rejecting', 'step1', 'down', 'append')).toThrow(/Unknown set/)
			expect(() => recorder.saveToControlId('rejecting', 'step1', 'down', 'replace')).toThrow(/Unknown set/)

			expect(recorder.getSession().id).toBe(sessionId)
		})
	})

	describe('trpc', () => {
		test('sessionList yields the current sessions', async () => {
			const { recorder, caller } = createRecorder()
			const sessionId = recorder.getSession().id

			const subscription = new SubscriptionTester(await caller.sessionList())
			await subscription.expectValue({ [sessionId]: { connectionIds: [] } })

			// The generator only starts listening once the next value is pulled,
			// so start the pull before triggering the change
			const pendingNext = subscription.next()
			await new Promise((resolve) => setImmediate(resolve))
			recorder.setSelectedConnectionIds(['conn1'])
			expect(await pendingNext).toEqual({ [sessionId]: { connectionIds: ['conn1'] } })

			await subscription.cleanup()
		})

		test('session.watch yields init then patches', async () => {
			const { recorder, caller } = createRecorder()
			const sessionId = recorder.getSession().id

			const subscription = new SubscriptionTester(await caller.session.watch({ sessionId }))
			const init = (await subscription.next()) as any
			expect(init.type).toBe('init')
			expect(init.session.id).toBe(sessionId)

			recorder.setSelectedConnectionIds(['conn1'])
			const patch = (await subscription.next()) as any
			expect(patch.type).toBe('patch')

			await subscription.cleanup()
		})

		test('session mutations reject a wrong session id', async () => {
			const { caller } = createRecorder()

			await expect(caller.session.abort({ sessionId: 'wrong' })).rejects.toThrow(/Invalid session/)
			await expect(caller.session.discardActions({ sessionId: 'wrong' })).rejects.toThrow(/Invalid session/)
			await expect(caller.session.setRecording({ sessionId: 'wrong', isRunning: true })).rejects.toThrow(
				/Invalid session/
			)
			await expect(caller.session.setConnections({ sessionId: 'wrong', connectionIds: [] })).rejects.toThrow(
				/Invalid session/
			)
		})

		test('session mutations work with the correct id', async () => {
			const { recorder, caller } = createRecorder()
			const sessionId = recorder.getSession().id

			await caller.session.setConnections({ sessionId, connectionIds: ['conn1'] })
			expect(recorder.getSession().connectionIds).toEqual(['conn1'])

			await caller.session.setRecording({ sessionId, isRunning: true })
			expect(recorder.getSession().isRunning).toBe(true)

			await caller.session.abort({ sessionId })
			expect(recorder.getSession().id).not.toBe(sessionId)
			expect(recorder.getSession().isRunning).toBe(false)
		})

		test('action.delete removes the action', async () => {
			const { recorder, caller } = createRecorder()
			const sessionId = recorder.getSession().id
			recorder.setSelectedConnectionIds(['conn1'])
			recorder.receiveAction('conn1', 'act1', {}, 0, undefined)
			const actionId = recorder.getSession().actions[0].id

			await caller.session.action.delete({ sessionId, actionId })

			expect(recorder.getSession().actions).toEqual([])
		})

		test('action.duplicate copies the action after the original', async () => {
			const { recorder, caller } = createRecorder()
			const sessionId = recorder.getSession().id
			recorder.setSelectedConnectionIds(['conn1'])
			recorder.receiveAction('conn1', 'act1', {}, 0, undefined)
			recorder.receiveAction('conn1', 'act2', {}, 0, undefined)
			const actionId = recorder.getSession().actions[0].id

			await caller.session.action.duplicate({ sessionId, actionId })

			const actions = recorder.getSession().actions
			expect(actions).toHaveLength(3)
			expect(actions[1].definitionId).toBe('act1')
			expect(actions[1].id).not.toBe(actionId)
			expect(actions[2].definitionId).toBe('act2')
		})

		test('action.setValue updates the option value', async () => {
			const { recorder, caller } = createRecorder()
			const sessionId = recorder.getSession().id
			recorder.setSelectedConnectionIds(['conn1'])
			recorder.receiveAction('conn1', 'act1', { speed: 1 }, 0, undefined)
			const actionId = recorder.getSession().actions[0].id

			await caller.session.action.setValue({
				sessionId,
				actionId,
				key: 'speed',
				value: { isExpression: false, value: 5 },
			})

			expect(recorder.getSession().actions[0].options).toEqual({ speed: { isExpression: false, value: 5 } })
		})

		test('action.setValue rejects banned keys', async () => {
			const { recorder, caller } = createRecorder()
			const sessionId = recorder.getSession().id
			recorder.setSelectedConnectionIds(['conn1'])
			recorder.receiveAction('conn1', 'act1', {}, 0, undefined)
			const actionId = recorder.getSession().actions[0].id

			await expect(
				caller.session.action.setValue({
					sessionId,
					actionId,
					key: '__proto__',
					value: { isExpression: false, value: 'evil' },
				})
			).rejects.toThrow(/not allowed/)
		})

		test('action.reorder moves the action with clamping', async () => {
			const { recorder, caller } = createRecorder()
			const sessionId = recorder.getSession().id
			recorder.setSelectedConnectionIds(['conn1'])
			recorder.receiveAction('conn1', 'act1', {}, 0, undefined)
			recorder.receiveAction('conn1', 'act2', {}, 0, undefined)
			recorder.receiveAction('conn1', 'act3', {}, 0, undefined)
			const actionId = recorder.getSession().actions[0].id

			await caller.session.action.reorder({ sessionId, actionId, newIndex: 2 })
			expect(recorder.getSession().actions.map((a) => a.definitionId)).toEqual(['act2', 'act3', 'act1'])

			await caller.session.action.reorder({ sessionId, actionId, newIndex: -10 })
			expect(recorder.getSession().actions.map((a) => a.definitionId)).toEqual(['act1', 'act2', 'act3'])

			await expect(caller.session.action.reorder({ sessionId, actionId: 'missing', newIndex: 0 })).rejects.toThrow(
				/Invalid action/
			)
		})

		test('saveToControl saves and resets', async () => {
			const { recorder, caller, controls } = createRecorder()
			const control = makeEntityControl()
			controls['control1'] = control
			const sessionId = recorder.getSession().id
			recorder.setSelectedConnectionIds(['conn1'])
			recorder.receiveAction('conn1', 'act1', {}, 0, undefined)

			await caller.session.saveToControl({
				sessionId,
				controlId: 'control1',
				stepId: 'step1',
				setId: 'down',
				mode: 'append',
			})

			expect(control.entities.entityAdd).toHaveBeenCalled()
			expect(recorder.getSession().id).not.toBe(sessionId)
		})
	})
})
