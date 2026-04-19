// test/useLayoutMode.test.ts
import { describe, expect, it } from 'vitest'
import '../src/App.scss' // Points to your entry Sass file
import { getBreakpoints } from '../src/Hooks/useLayoutMode'

describe('getBreakpoints CSS Integration', () => {
	it('should extract all CoreUI/Bootstrap breakpoints without throwing', () => {
		// This will execute your "throw" logic if prefix or variables are missing
		const breakpoints = getBreakpoints()

		// Define the keys we expect based on your BreakpointName type
		const expectedBreakpoints = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'] as const

		// Regex matches common CSS units (e.g., '0', '1200px', '80.5rem')
		const cssUnitRegex = /^\d+(\.\d+)?(px|rem|em|vh|vw|%)?$/

		expectedBreakpoints.forEach((name) => {
			const value = breakpoints[name]

			// 1. Check that the key exists
			expect(breakpoints).toHaveProperty(name)

			// 2. Check that the value isn't empty/undefined
			expect(value).toBeDefined()
			expect(value.length).toBeGreaterThan(0)

			// 3. Check that the value is a valid CSS measurement
			// (This ensures we didn't just get an empty string from getPropertyValue)
			expect(value).toMatch(cssUnitRegex)
		})
	})

	it('should have an XL breakpoint strictly larger than the LG breakpoint', () => {
		const { lg, xl } = getBreakpoints()

		// Convert "1200px" -> 1200
		// Note: Assumes both breakpoints use the same unit (typically px in Bootstrap/CoreUI)
		const lgNum = parseInt(lg, 10)
		const xlNum = parseInt(xl, 10)

		expect(xlNum).toBeGreaterThan(lgNum)
	})
})
