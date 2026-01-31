import { describe, test, expect, vi } from 'vitest'
import type { ControlEntityListPoolProps } from '../../../lib/Controls/Entities/EntityListPoolBase.js'
import { ControlEntityListPoolButton } from '../../../lib/Controls/Entities/EntityListPoolButton.js'

describe('EntityListPool', () => {
	function createMockDependencies(controlId: string): ControlEntityListPoolProps {
		return {
			instanceDefinitions: null as any,
			internalModule: null as any,
			processManager: null as any,
			variableValues: null as any,
			controlId,
			commitChange: vi.fn(),
			invalidateControl: vi.fn(),
		}
	}

	test('construction', () => {
		const deps = createMockDependencies('test01')
		const sendRuntimeProps = vi.fn()
		const executeExpression = vi.fn()
		const pool = new ControlEntityListPoolButton(deps, sendRuntimeProps, executeExpression)

		expect(pool.getActiveStepIndex()).toBe(0)
		expect(pool.getStepIds()).toEqual(['0'])
		expect(pool.getAllEntities()).toHaveLength(0)
		expect(sendRuntimeProps).toHaveBeenCalledTimes(0)
		expect(deps.commitChange).toHaveBeenCalledTimes(0)
		expect(deps.invalidateControl).toHaveBeenCalledTimes(0)
	})

	test('add step from empty', () => {
		const deps = createMockDependencies('test02')
		const sendRuntimeProps = vi.fn()
		const executeExpression = vi.fn()
		const pool = new ControlEntityListPoolButton(deps, sendRuntimeProps, executeExpression)

		pool.stepAdd()
		expect(pool.getActiveStepIndex()).toBe(0)
		expect(pool.getStepIds()).toEqual(['0', '1'])
		expect(pool.getAllEntities()).toHaveLength(0)
		expect(sendRuntimeProps).toHaveBeenCalledTimes(0)
		expect(deps.commitChange).toHaveBeenCalledTimes(1)
		expect(deps.commitChange).toHaveBeenCalledWith(true)
		expect(deps.invalidateControl).toHaveBeenCalledTimes(0)
	})
})
