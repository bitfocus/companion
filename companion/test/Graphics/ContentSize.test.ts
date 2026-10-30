import { describe, expect, test } from 'vitest'
import { ButtonGraphicsDecorationType } from '@companion-app/shared/Model/StyleModel.js'
import { contentSizeOf } from '../../lib/Graphics/ContentSize.js'

describe('contentSizeOf', () => {
	test('a top bar takes the top of the button', () => {
		// At least 14px, else a fifth of the height
		expect(contentSizeOf({ width: 72, height: 72 }, ButtonGraphicsDecorationType.TopBar)).toEqual({
			width: 72,
			height: 58,
		})
		expect(contentSizeOf({ width: 200, height: 100 }, ButtonGraphicsDecorationType.TopBar)).toEqual({
			width: 200,
			height: 80,
		})
	})

	test('other decorations take nothing', () => {
		expect(contentSizeOf({ width: 72, height: 72 }, ButtonGraphicsDecorationType.None)).toEqual({
			width: 72,
			height: 72,
		})
		expect(contentSizeOf({ width: 72, height: 72 }, ButtonGraphicsDecorationType.Border)).toEqual({
			width: 72,
			height: 72,
		})
	})
})
