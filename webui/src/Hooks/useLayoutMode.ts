import { useMediaQuery } from 'usehooks-ts'

export interface LayoutModes {
	twoPanelMode: boolean
	mobileMode: boolean
}

/* useLayoutMode:
 * Establish a "single point of truth" for window-width breakpoints
 * return - {twoPanelMode, mobileMode} (booleans)
 *   twoPanelMode - whether we should use one or two panels
 *   mobileMode - whether we're in mobile mode
 *  (in mobile mode the sidebar is hidden and activated with a "hamburger" in the top-left header)
 */
export function useLayoutMode(): LayoutModes {
	const breakpoints = getBreakpoints()

	const twoPanelBreak = breakpoints.xl // when to switch to-from two-panel (twoPanel is larger)
	// (mobileMode is a bit wide. 880 would be better but isn't a standard breakpoint lg: 992; md: 768)
	// ideally we would calculate this from desired min panel widths and sidebar width (folding or not)...
	// (note: --cui-mobile-breakpoint also defaults to lg)
	const mobileBreak = breakpoints.lg // when to switch to-from one-panel (mobile is smaller)

	const twoPanelMode = useMediaQuery(`(min-width: ${twoPanelBreak})`) // true when wider
	const mobileMode = !useMediaQuery(`(min-width: ${mobileBreak})`) // true when narrower!

	return { twoPanelMode, mobileMode }
}

/**
 * The following is loosely derived from Stefan Haack (https://shaack.com)
 * Repository: https://github.com/shaack/bootstrap-detect-breakpoint
 * License: MIT, see file 'LICENSE'
 * Modified extensively for typescript, cui compatibility, and reduced functionality by arikorn (03-2026)
 */

type BreakpointName = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'

let breakpointsInitialized = false
// start with default bootstrap values
const breakpointValues: Record<BreakpointName, string> = {
	xs: '0px',
	sm: '576px',
	md: '768px',
	lg: '992px',
	xl: '1200px',
	xxl: '1400px',
}

function getBreakpoints(): Record<BreakpointName, string> {
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
		// strict: complain if can't find prefix
		if (!prefix) throw new Error("Couldn't determine breakpoints prefix.")
		for (const name of Object.keys(breakpointValues) as BreakpointName[]) {
			const value = computedStyle.getPropertyValue(prefix + name)
			if (value) {
				breakpointValues[name] = value
			} else if (name !== 'xs') {
				// strict: complain if definition is missing
				throw new Error('Missing breakpoint definition for: ' + name)
			}
		}
	}

	return breakpointValues
}
