import { describe, expect, test } from 'vitest'
import { BANNED_PROPS as SATELLITE_BANNED_PROPS } from '@companion-app/satellite-protocol'
import { BANNED_PROPS } from '@companion-app/shared/Expressions.js'

describe('satellite-protocol BANNED_PROPS', () => {
	// The satellite-protocol package keeps its own copy so it stays dependency-free; make sure it doesn't drift
	test('matches the expressions BANNED_PROPS', () => {
		expect([...SATELLITE_BANNED_PROPS].sort()).toEqual([...BANNED_PROPS].sort())
	})
})
