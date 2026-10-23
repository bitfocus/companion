import { initTRPC } from '@trpc/server'
import { describe, expect, test, vi } from 'vitest'
import { createActionSetsTrpcRouter } from '../../lib/Controls/ActionSetsTrpcRouter.js'
import type { SomeStepManager } from '../../lib/Controls/Entities/ControlActionSetAndStepsManager.js'
import { ControlEntityListPoolButton } from '../../lib/Controls/Entities/EntityListPoolButton.js'
import type { SomeControl } from '../../lib/Controls/IControlFragments.js'
import type { TrpcContext } from '../../lib/UI/TRPC.js'
import { createMockTrpcContext } from '../Util.js'
import { createPool, createPoolDeps } from './Entities/EntityListPoolTestHelpers.js'

const t = initTRPC.context<TrpcContext>().create()

function createCaller(actionSets: SomeStepManager) {
	const controls = new Map<string, SomeControl<any>>([
		[
			'control0',
			{
				supportsActionSets: true,
				actionSets,
			} as SomeControl<any>,
		],
	])
	return t.createCallerFactory(createActionSetsTrpcRouter(controls))(createMockTrpcContext())
}

describe('action-set surface cue preference router', () => {
	test('updates an editable action set', async () => {
		const { pool } = createPool()
		const caller = createCaller(pool)

		await expect(
			caller.setControlEvents({ controlId: 'control0', stepId: '0', setId: 'down', enabled: false })
		).resolves.toBe(true)
		expect(pool.isActionSetControlEventsEnabled('0', 'down')).toBe(false)
	})

	test('rejects rotary groups at the API boundary', async () => {
		const { pool } = createPool()
		const caller = createCaller(pool)

		await expect(
			caller.setControlEvents({
				controlId: 'control0',
				stepId: '0',
				setId: 'rotate_left' as never,
				enabled: false,
			})
		).rejects.toThrow('Invalid or malformed input')
	})

	test('refuses preference edits for a read-only action set manager', async () => {
		const pool = new ControlEntityListPoolButton(createPoolDeps({ controlId: 'readonly' }).deps, vi.fn(), true)
		const caller = createCaller(pool)

		await expect(
			caller.setControlEvents({ controlId: 'control0', stepId: '0', setId: 'down', enabled: false })
		).rejects.toThrow('does not support this operation')
	})
})
