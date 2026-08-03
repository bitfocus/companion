import { describe, expect, test, vi } from 'vitest'
import type { ActionRunner } from '../../lib/Controls/ActionRunner.js'
import type { ControlEntityInstance } from '../../lib/Controls/Entities/EntityInstance.js'
import type { FeedbackExecutionContext } from '../../lib/Controls/Entities/Types.js'
import type { RunActionExtras } from '../../lib/Instance/Connection/ChildHandlerApi.js'
import { InternalBuildingBlocks } from '../../lib/Internal/BuildingBlocks.js'
import type { ActionForInternalExecution } from '../../lib/Internal/Types.js'

function makeExtras(overrides: Partial<RunActionExtras> = {}): RunActionExtras {
	return {
		controlId: 'control:test',
		surfaceId: 'surface1',
		location: { pageNumber: 1, row: 0, column: 0 },
		abortDelayed: new AbortController().signal,
		executionMode: 'concurrent',
		rotationDelta: null,
		...overrides,
	}
}

/**
 * Build a fake `action.rawEntity` whose child groups are backed by the provided callbacks. This lets us
 * assert exactly which `FeedbackExecutionContext` the condition group is evaluated with, and which action
 * group is run.
 */
function makeAction(
	definitionId: string,
	children: Record<
		string,
		{
			getChildBooleanFeedbackValues?: (context: FeedbackExecutionContext | null) => boolean[]
			getDirectEntities?: () => ControlEntityInstance[]
		}
	>
): ActionForInternalExecution {
	const rawEntity = {
		getChildren: vi.fn((groupId: string) => children[groupId]),
	} as unknown as ControlEntityInstance

	return {
		id: 'action1',
		definitionId,
		options: {},
		rawEntity,
	}
}

describe('logic_if', () => {
	test('runs the `actions` group and evaluates the condition with a fresh context', async () => {
		const runMultipleActions = vi.fn<ActionRunner['runMultipleActions']>(async () => {})
		const blocks = new InternalBuildingBlocks({ runMultipleActions } as unknown as ActionRunner)

		const actionEntity = { id: 'then' } as ControlEntityInstance
		const getChildBooleanFeedbackValues = vi.fn(() => [true, true])
		const action = makeAction('logic_if', {
			condition: { getChildBooleanFeedbackValues },
			actions: { getDirectEntities: () => [actionEntity] },
			else_actions: { getDirectEntities: () => [{ id: 'else' } as ControlEntityInstance] },
		})

		const context: FeedbackExecutionContext = { parser: {} as any }
		const createFeedbackContext = vi.fn(() => context)

		await blocks.executeAction(action, makeExtras(), {} as any, createFeedbackContext)

		expect(createFeedbackContext).toHaveBeenCalledTimes(1)
		expect(getChildBooleanFeedbackValues).toHaveBeenCalledWith(context)
		expect(runMultipleActions).toHaveBeenCalledTimes(1)
		expect(runMultipleActions.mock.calls[0][0]).toEqual([actionEntity])
	})

	test('runs the `else_actions` group when the condition is false', async () => {
		const runMultipleActions = vi.fn<ActionRunner['runMultipleActions']>(async () => {})
		const blocks = new InternalBuildingBlocks({ runMultipleActions } as unknown as ActionRunner)

		const elseEntity = { id: 'else' } as ControlEntityInstance
		const action = makeAction('logic_if', {
			condition: { getChildBooleanFeedbackValues: () => [false] },
			actions: { getDirectEntities: () => [{ id: 'then' } as ControlEntityInstance] },
			else_actions: { getDirectEntities: () => [elseEntity] },
		})

		await blocks.executeAction(action, makeExtras(), {} as any, () => ({ parser: {} as any }))

		expect(runMultipleActions).toHaveBeenCalledTimes(1)
		expect(runMultipleActions.mock.calls[0][0]).toEqual([elseEntity])
	})
})

describe('logic_while', () => {
	test('rebuilds the feedback context on every iteration', async () => {
		const runMultipleActions = vi.fn<ActionRunner['runMultipleActions']>(async () => {})
		const blocks = new InternalBuildingBlocks({ runMultipleActions } as unknown as ActionRunner)

		// Condition is true for the first two iterations, then false
		let calls = 0
		const getChildBooleanFeedbackValues = vi.fn(() => {
			calls += 1
			return [calls <= 2]
		})
		const action = makeAction('logic_while', {
			condition: { getChildBooleanFeedbackValues },
			actions: { getDirectEntities: () => [{ id: 'repeat' } as ControlEntityInstance] },
		})

		const createFeedbackContext = vi.fn(() => ({ parser: {} as any }))

		await blocks.executeAction(action, makeExtras(), {} as any, createFeedbackContext)

		// Evaluated once per loop entry: true, true, false
		expect(getChildBooleanFeedbackValues).toHaveBeenCalledTimes(3)
		expect(createFeedbackContext).toHaveBeenCalledTimes(3)
		// The body ran for the two truthy iterations
		expect(runMultipleActions).toHaveBeenCalledTimes(2)

		// A distinct context object was produced each iteration
		const contexts = createFeedbackContext.mock.results.map((r) => r.value)
		expect(new Set(contexts).size).toBe(3)
	})

	test('does not run when the condition starts false', async () => {
		const runMultipleActions = vi.fn<ActionRunner['runMultipleActions']>(async () => {})
		const blocks = new InternalBuildingBlocks({ runMultipleActions } as unknown as ActionRunner)

		const action = makeAction('logic_while', {
			condition: { getChildBooleanFeedbackValues: () => [false] },
			actions: { getDirectEntities: () => [{ id: 'repeat' } as ControlEntityInstance] },
		})

		await blocks.executeAction(action, makeExtras(), {} as any, () => ({ parser: {} as any }))

		expect(runMultipleActions).not.toHaveBeenCalled()
	})
})
