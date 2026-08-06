import { describe, expect, test } from 'vitest'
import { FeedbackEntitySubType } from '@companion-app/shared/Model/EntityModel.js'
import { defaultStyleOverrideValue, feedbackTypeInteractionHelp } from '../LayeredStylesOverrides.js'

describe('defaultStyleOverrideValue', () => {
	test('value feedbacks are seeded with a $(this:value) expression', () => {
		expect(defaultStyleOverrideValue(FeedbackEntitySubType.Value)).toEqual({
			isExpression: true,
			value: '$(this:value)',
		})
	})

	test('boolean feedbacks start from an empty plain value', () => {
		expect(defaultStyleOverrideValue(FeedbackEntitySubType.Boolean)).toEqual({ isExpression: false, value: '' })
	})

	test('advanced feedbacks start from an empty plain value', () => {
		expect(defaultStyleOverrideValue(FeedbackEntitySubType.Advanced)).toEqual({ isExpression: false, value: '' })
	})

	test('undefined feedback type starts from an empty plain value', () => {
		expect(defaultStyleOverrideValue(undefined)).toEqual({ isExpression: false, value: '' })
	})
})

describe('feedbackTypeInteractionHelp', () => {
	test.each([FeedbackEntitySubType.Value, FeedbackEntitySubType.Boolean, FeedbackEntitySubType.Advanced])(
		'returns an icon, title and description for %s feedbacks',
		(feedbackType) => {
			const info = feedbackTypeInteractionHelp(feedbackType)
			expect(info).not.toBeNull()
			expect(info?.icon).toBeTruthy()
			expect(info?.title.length).toBeGreaterThan(0)
			expect(info?.description.length).toBeGreaterThan(0)
		}
	)

	test('value feedback description mentions $(this:value) and the undefined behaviour', () => {
		const info = feedbackTypeInteractionHelp(FeedbackEntitySubType.Value)
		expect(info?.description).toContain('$(this:value)')
		expect(info?.description).toContain('undefined')
	})

	test('the legacy style feedback is not surfaced to users as "advanced"', () => {
		const info = feedbackTypeInteractionHelp(FeedbackEntitySubType.Advanced)
		expect(info?.title.toLowerCase()).not.toContain('advanced')
		expect(info?.description.toLowerCase()).not.toContain('advanced')
		expect(info?.title.toLowerCase()).toContain('legacy')
	})

	test('returns null for unknown / non-override feedback types', () => {
		expect(feedbackTypeInteractionHelp(FeedbackEntitySubType.StyleOverride)).toBeNull()
		expect(feedbackTypeInteractionHelp(null)).toBeNull()
		expect(feedbackTypeInteractionHelp(undefined)).toBeNull()
	})
})
