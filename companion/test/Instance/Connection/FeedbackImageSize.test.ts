import { describe, expect, test } from 'vitest'
import { ButtonDecorationRenderer } from '@companion-app/shared/Graphics/ButtonDecorationRenderer.js'
import { getFeedbackImageSizeForControl } from '../../../lib/Instance/Connection/FeedbackImageSize.js'

const expectedSize = { width: 72, height: 72 - ButtonDecorationRenderer.DEFAULT_HEIGHT }

/** A control stub with just the properties the helper reads. */
function makeControl(props: { drawing: unknown; supportsLayeredStyle: boolean }): any {
	return props
}

describe('getFeedbackImageSizeForControl', () => {
	test('a missing control has no size', () => {
		expect(getFeedbackImageSizeForControl(undefined)).toBeUndefined()
	})

	test('a control which does not draw has no size', () => {
		// e.g. a trigger or an expression variable
		expect(getFeedbackImageSizeForControl(makeControl({ drawing: null, supportsLayeredStyle: false }))).toBeUndefined()
	})

	test('an editable button gets the size', () => {
		expect(getFeedbackImageSizeForControl(makeControl({ drawing: {}, supportsLayeredStyle: true }))).toEqual(
			expectedSize
		)
	})

	test('a button which draws but cannot be style-edited still gets the size', () => {
		// e.g. a preset reference: read-only, but it renders a button and its advanced feedbacks must
		// still be able to produce an imageBuffer
		expect(getFeedbackImageSizeForControl(makeControl({ drawing: {}, supportsLayeredStyle: false }))).toEqual(
			expectedSize
		)
	})
})
