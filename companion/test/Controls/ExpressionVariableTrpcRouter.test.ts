import { EventEmitter } from 'node:events'
import { initTRPC } from '@trpc/server'
import { describe, expect, it, vi } from 'vitest'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { createExpressionVariableTrpcRouter } from '../../lib/Controls/ExpressionVariableTrpcRouter.js'
import type { TrpcContext } from '../../lib/UI/TRPC.js'
import { createMockTrpcContext } from '../Util.js'

describe('ExpressionVariableTrpcRouter', () => {
	function setup() {
		const t = initTRPC.context<TrpcContext>().create()

		const rootEntity = {
			type: EntityModelType.Feedback,
			id: 'root',
			connectionId: 'internal',
			definitionId: 'expression_value',
			options: {},
			upgradeIndex: undefined,
		}

		const controls = new Map<string, any>()
		const newControl = {
			options: { variableName: 'my_var' },
			storedWhenStarted: undefined as boolean | undefined,
			start: vi.fn(),
		}
		const factory = { createExpressionVariable: vi.fn((_id: string, _storage: unknown) => newControl) }
		const expressionVariableNamesMap = { addExpressionVariable: vi.fn() }
		newControl.start.mockImplementation(() => {
			newControl.storedWhenStarted = [...controls.values()].includes(newControl)
		})

		const router = createExpressionVariableTrpcRouter(
			new EventEmitter() as any,
			{ createTrpcRouter: () => t.router({}) } as any,
			{ controls } as any,
			expressionVariableNamesMap as any,
			{ createEntityItem: vi.fn(() => rootEntity) } as any,
			factory as any
		)
		const caller = t.createCallerFactory(router)(createMockTrpcContext())

		return { caller, controls, newControl, factory, expressionVariableNamesMap, rootEntity }
	}

	describe('create', () => {
		it('builds the control complete, then stores, registers and starts it', async () => {
			const { caller, newControl, factory, expressionVariableNamesMap, rootEntity } = setup()

			const controlId = await caller.create({ variableName: 'my_var' })

			// Never stored without its root entity
			expect(factory.createExpressionVariable).toHaveBeenCalledWith(
				controlId,
				expect.objectContaining({
					type: 'expression-variable',
					entity: rootEntity,
					options: expect.objectContaining({ variableName: 'my_var', sortOrder: 0 }),
				})
			)

			expect(newControl.start).toHaveBeenCalledTimes(1)
			expect(newControl.start).toHaveBeenCalledWith(true)
			expect(newControl.storedWhenStarted).toBe(true)

			// The saved client state includes whether it is active, which the names map decides
			expect(expressionVariableNamesMap.addExpressionVariable).toHaveBeenCalledWith(controlId, 'my_var')
			expect(expressionVariableNamesMap.addExpressionVariable.mock.invocationCallOrder[0]).toBeLessThan(
				newControl.start.mock.invocationCallOrder[0]
			)
		})

		it('rejects an invalid variable name without creating anything', async () => {
			const { caller, controls, factory } = setup()

			await expect(caller.create({ variableName: 'not valid!' })).rejects.toThrow()

			expect(factory.createExpressionVariable).not.toHaveBeenCalled()
			expect(controls.size).toBe(0)
		})
	})
})
