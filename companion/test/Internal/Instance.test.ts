import { describe, expect, it, vi } from 'vitest'
import { EntityModelType, type FeedbackEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import { exprVal } from '@companion-app/shared/Model/Options.js'
import type { InstanceController } from '../../lib/Instance/Controller.js'
import { InternalInstance } from '../../lib/Internal/Instance.js'

// ---- helpers ----------------------------------------------------------------

function createInstance(): InternalInstance {
	const instanceController = {
		status: { on: vi.fn() },
		on: vi.fn(),
	} as unknown as InstanceController

	return new InternalInstance(instanceController)
}

function makeFeedback(definitionId: string, options: Record<string, unknown>): FeedbackEntityModel {
	return {
		type: EntityModelType.Feedback,
		id: 'fb1',
		definitionId,
		connectionId: 'internal',
		options,
		upgradeIndex: undefined,
	} as FeedbackEntityModel
}

// ---- tests ------------------------------------------------------------------

describe('InternalInstance', () => {
	describe('instance_custom_state definition', () => {
		it("offers a selectable 'Disabled' choice with a non-null id", () => {
			const internal = createInstance()
			const definition = internal.getFeedbackDefinitions()['instance_custom_state']

			const stateOption = definition.options.find((o) => o.id === 'state') as any
			const disabledChoice = stateOption.choices.find((c: any) => c.label === 'Disabled')

			expect(disabledChoice.id).toBe('null')
			// A null id cannot be represented/selected by the UI dropdown
			expect(disabledChoice.id).not.toBeNull()
		})
	})

	describe('feedbackUpgrade', () => {
		it("migrates a null instance_custom_state to the string 'null'", () => {
			const internal = createInstance()
			const feedback = makeFeedback('instance_custom_state', { state: exprVal(null), instance_id: exprVal('abc') })

			const result = internal.feedbackUpgrade(feedback, 'ctrl1')

			expect(result).toBeTruthy()
			expect(feedback.options.state).toEqual(exprVal('null'))
		})

		it('leaves a non-null instance_custom_state state untouched', () => {
			const internal = createInstance()
			const feedback = makeFeedback('instance_custom_state', { state: exprVal('good'), instance_id: exprVal('abc') })

			const result = internal.feedbackUpgrade(feedback, 'ctrl1')

			expect(result).toBeUndefined()
			expect(feedback.options.state).toEqual(exprVal('good'))
		})

		it('ignores other feedback types', () => {
			const internal = createInstance()
			const feedback = makeFeedback('instance_status', { state: exprVal(null) })

			const result = internal.feedbackUpgrade(feedback, 'ctrl1')

			expect(result).toBeUndefined()
		})
	})
})
