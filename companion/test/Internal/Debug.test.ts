import { afterEach, describe, expect, it, vi } from 'vitest'
import { CreateBankControlId } from '@companion-app/shared/ControlId.js'
import { exprExpr, SomeCompanionInputFieldSchema } from '@companion-app/shared/Model/Options.js'
import type { ControlEntityInstance } from '../../lib/Controls/Entities/EntityInstance.js'
import { InternalDebug } from '../../lib/Internal/Debug.js'
import type { ActionForInternalExecution, FeedbackForInternalExecution } from '../../lib/Internal/Types.js'

function makeAction(definitionId: string, options: Record<string, unknown>): ActionForInternalExecution {
	return {
		id: 'test-id',
		definitionId,
		options: options as any,
		rawEntity: { rawOptions: { expression: exprExpr('{ foo: 1 }') } } as unknown as ControlEntityInstance,
	}
}

function makeFeedback(definitionId: string, options: Record<string, unknown>): FeedbackForInternalExecution {
	return {
		controlId: CreateBankControlId('ctrl1'),
		location: undefined,
		id: 'fb1',
		definitionId,
		options: options as any,
	}
}

afterEach(() => {
	vi.unstubAllEnvs()
})

describe('definitions', () => {
	it('offers the debug entities when running from source', () => {
		const module = new InternalDebug()
		expect(Object.keys(module.getActionDefinitions())).toEqual(['debug_action_result', 'debug_all_fields'])
		expect(Object.keys(module.getFeedbackDefinitions())).toEqual(['debug_expression_value', 'debug_all_fields'])
	})

	it('offers nothing when packaged', () => {
		vi.stubEnv('COMPANION_BUNDLED', '1')
		const module = new InternalDebug()
		expect(module.getActionDefinitions()).toEqual({})
		expect(module.getFeedbackDefinitions()).toEqual({})
	})

	it('debug_all_fields has a valid option of each kind of field', () => {
		const options = new InternalDebug().getActionDefinitions().debug_all_fields.options
		for (const option of options) {
			expect(SomeCompanionInputFieldSchema.safeParse(option).error, option.id).toBeUndefined()
		}
		expect(new Set(options.map((option) => option.id)).size).toBe(options.length)
	})
})

describe('executeAction', () => {
	const module = new InternalDebug()

	it('debug_action_result returns the evaluated expression as the action result', () => {
		// optionsSupportExpressions parses the expression before executeAction, so options.expression
		// is already the evaluated blob.
		expect(module.executeAction(makeAction('debug_action_result', { expression: { foo: 1 } }))).toEqual({
			result: { foo: 1 },
		})
	})

	it('debug_all_fields does nothing', () => {
		expect(module.executeAction(makeAction('debug_all_fields', {}))).toEqual({ result: undefined })
	})

	it('returns null for an action of another fragment', () => {
		expect(module.executeAction(makeAction('not_a_real_action', {}))).toBeNull()
	})
})

describe('executeFeedback', () => {
	const module = new InternalDebug()

	it('debug_expression_value coerces non-objects to an empty style', () => {
		expect(module.executeFeedback(makeFeedback('debug_expression_value', { expression: 'not-an-object' }))).toEqual({})
		expect(module.executeFeedback(makeFeedback('debug_expression_value', { expression: { color: 1 } }))).toEqual({
			color: 1,
		})
	})

	it('debug_all_fields is always false', () => {
		expect(module.executeFeedback(makeFeedback('debug_all_fields', {}))).toBe(false)
	})

	it('ignores a feedback of another fragment', () => {
		expect(module.executeFeedback(makeFeedback('not_a_real_feedback', {}))).toBeUndefined()
	})
})
