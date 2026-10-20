import { describe, expect, it } from 'vitest'
import { EntityModelType, type SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import { exprExpr, exprVal } from '@companion-app/shared/Model/Options.js'
import { findModuleFeedbacksUsingRunValues } from '../RunValueReferences.js'

function feedback(
	connectionId: string,
	options: Record<string, any>,
	extra: Partial<SomeEntityModel> = {}
): SomeEntityModel {
	return {
		type: EntityModelType.Feedback,
		id: `${connectionId}-${Object.keys(options).join()}`,
		connectionId,
		definitionId: 'fb',
		options,
		upgradeIndex: undefined,
		...extra,
	}
}

describe('findModuleFeedbacksUsingRunValues', () => {
	it('finds module feedbacks referencing inputs or local variables', () => {
		const usesInput = feedback('conn1', { input: exprVal('$(options:n)') })
		const usesLocal = feedback('conn1', { other: exprExpr('$(local:v) + 1') })
		const usesNothing = feedback('conn1', { input: exprVal('$(custom:x)') })

		expect(findModuleFeedbacksUsingRunValues([usesInput, usesLocal, usesNothing])).toEqual([usesInput, usesLocal])
	})

	it('ignores internal feedbacks, which are evaluated for the run', () => {
		expect(findModuleFeedbacksUsingRunValues([feedback('internal', { input: exprVal('$(options:n)') })])).toEqual([])
	})

	it('ignores module actions, which are parsed for the run', () => {
		const action = { ...feedback('conn1', { input: exprVal('$(options:n)') }), type: EntityModelType.Action }
		expect(findModuleFeedbacksUsingRunValues([action as SomeEntityModel])).toEqual([])
	})

	it('ignores disabled feedbacks', () => {
		expect(
			findModuleFeedbacksUsingRunValues([feedback('conn1', { input: exprVal('$(options:n)') }, { disabled: true })])
		).toEqual([])
	})

	it('looks inside the children of entities', () => {
		const child = feedback('conn1', { input: exprVal('$(options:n)') })
		const parent = {
			type: EntityModelType.Action,
			id: 'if',
			connectionId: 'internal',
			definitionId: 'logic_if',
			options: {},
			upgradeIndex: undefined,
			children: { condition: [child] },
		} as SomeEntityModel

		expect(findModuleFeedbacksUsingRunValues([parent])).toEqual([child])
	})
})
