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
	// (note: --cui-mobile-breakpoint also defaults to lg)
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
		// prefix options in order of relevance: CoreUI, newer Bootstrap, older Bootstrap
		const prefixOptions = ['--cui-breakpoint-', '--bs-breakpoint-', '--breakpoint-']
		let prefix: string | null = null
		for (const p of prefixOptions) {
			if (computedStyle.getPropertyValue(p + 'sm')) {
				prefix = p
				break
			}
		}
		// strict: complain if can't find prefix so CI testing will flag the problem
		if (!prefix) throw new Error("Couldn't determine breakpoints prefix.")
		for (const name of Object.keys(breakpointValues) as BreakpointName[]) {
			const value = computedStyle.getPropertyValue(prefix + name)
			if (value) {
				breakpointValues[name] = value
			} else if (name !== 'xs') {
				// strict: complain if definition is missing so CI testing will flag the problem
				throw new Error('Missing breakpoint definition for: ' + name)
			}
		}
	}

	return breakpointValues
}
