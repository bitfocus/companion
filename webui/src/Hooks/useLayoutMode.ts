/* useLayoutMode.ts
 * Establish a "single point of truth" for window-width breakpoints
 *
 * Since we rarely need both 2-panel and mobile mode in the same component, this is split into
 * separate hooks.
 *
 * useTwoPanelMode:
 * return - (boolean) whether we should use one or two panels
 *
 * useMobileMode
 *   return - (boolean) whether we're in mobile mode
 *  (in mobile mode the sidebar is hidden and activated with a "hamburger" in the top-left header)
 */
import { useMediaQuery } from 'usehooks-ts'

export function useTwoPanelMode(): boolean {
	const breakpoints = getBreakpoints()

	const twoPanelBreak = breakpoints.xl // when to switch to-from two-panel

	return useMediaQuery(`(min-width: ${twoPanelBreak})`) // true when wider
}

export function useMobileMode(): boolean {
	const breakpoints = getBreakpoints()

	// (mobileMode is a bit wide. 880 would be better but isn't a standard breakpoint lg: 992; md: 768)
	// ideally we would calculate this from desired min panel widths and sidebar width (folding or not)...
	const mobileBreak = breakpoints.lg // when to switch to-from one-panel (mobile is smaller)

	return !useMediaQuery(`(min-width: ${mobileBreak})`) // true when narrower!
}

/**
 * The following is loosely derived from Stefan Haack (https://shaack.com)
 * Repository: https://github.com/shaack/bootstrap-detect-breakpoint
 * License: MIT, see file 'LICENSE'
 * Modified extensively for typescript, cui compatibility, and reduced functionality by arikorn (03-2026)
 */

type BreakpointName = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'

// Maps our breakpoint names to the Tailwind `--breakpoint-*` custom properties emitted by @theme (see
// tailwind.css). `xs` has no Tailwind variable — it is the implicit 0 floor — and `xxl` is Tailwind's
// `2xl`. The values mirror the CoreUI grid breakpoints the app has always used.
const breakpointVarSuffix: Record<BreakpointName, string | null> = {
	xs: null,
	sm: 'sm',
	md: 'md',
	lg: 'lg',
	xl: 'xl',
	xxl: '2xl',
}

let breakpointsInitialized = false
// start with default bootstrap values (in the current code we never use the default values, but it's good documentation and helps keep the type simple)
const breakpointValues: Record<BreakpointName, string> = {
	xs: '0px',
	sm: '576px',
	md: '768px',
	lg: '992px',
	xl: '1200px',
	xxl: '1400px',
}

// export, in part, so it can be tested
export function getBreakpoints(): Record<BreakpointName, string> {
	if (!breakpointsInitialized) {
		breakpointsInitialized = true // note that this means the errors, below will only fire once.
		const computedStyle = window.getComputedStyle(document.documentElement)
		for (const name of Object.keys(breakpointValues) as BreakpointName[]) {
			const suffix = breakpointVarSuffix[name]
			if (suffix === null) continue // xs has no variable; it stays at its 0px default
			const value = computedStyle.getPropertyValue('--breakpoint-' + suffix).trim()
			if (value) {
				breakpointValues[name] = value
			} else {
				// strict: complain if definition is missing so CI testing will flag the problem
				throw new Error('Missing breakpoint definition for: ' + name)
			}
		}
	}

	return breakpointValues
}
