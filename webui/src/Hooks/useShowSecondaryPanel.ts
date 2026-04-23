import { useLocation, useMatchRoute, useNavigate, type ToOptions } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { useTwoPanelMode } from './useLayoutMode'

interface UseShowSecondaryPanel {
	/** Uses TanStack's internal type for strict type-checking and route autocomplete */
	secondaryRoute: ToOptions['to']
	baseRoute: ToOptions['to'] // aka the default route for this page.
}

/* useShowSecondaryPanel
 *  Determine whether to allow the secondary (i.e. right) panel to show and adjust routes to match window-width
 *  This hook assumes that the secondary route is strictly used as a placemarker to make the content visible in 1-panel mode
 *
 * args:
 *   baseRoute: the default route for this page
 *   secondaryRoute: the route used to force the right-panel to be seen when in single-panel mode
 *
 *  Returns true if current route is the placeholder or its children
 */
export function useShowSecondaryPanel({ baseRoute, secondaryRoute }: UseShowSecondaryPanel): boolean {
	const twoPanelMode = useTwoPanelMode()
	const matchRoute = useMatchRoute()
	const navigate = useNavigate()

	// useLocation() forces the hook to re-render whenever the URL path changes
	const location = useLocation()
	const prevLocation = useRef(location) // to change immediately on route change

	// Handle the various cases in which we want to show the settings panel (when window is narrow)
	// 1. if one of the subpanels is currently visible or user clicked "Show Settings"
	const showSecondary = !!matchRoute({ to: secondaryRoute, fuzzy: true })

	useEffect(() => {
		// if left-panel is visible and we're at the top-level, remove the "secondaryPanel" route-placeholder
		const checkVisibility = () => {
			if (showSecondary && twoPanelMode) {
				// if we are at the base level of the secondaryPanel's stack of panels and in two panel mode, adjust the route
				const isPlaceholderRoute = !!matchRoute({ to: secondaryRoute, fuzzy: false })
				if (isPlaceholderRoute) {
					// Turn off showSettings if the user widens the window enough to expose the left panel.
					// this prevents a possibly confusing results of the setting showing up "spontaneously" if the window narrows again.
					void navigate({ to: baseRoute, replace: true })
				}
			}
		}
		// Handle window-size change and route changes
		// When resizing, the delay gives the user a chance to make the window narrow again if they overshot.
		// On route-change there's no need to delay so do it without delay.
		const newLoc = location !== prevLocation.current
		const handler = setTimeout(checkVisibility, newLoc ? 0 : 1000)
		prevLocation.current = location
		return () => {
			clearTimeout(handler)
		}
	}, [twoPanelMode, matchRoute, navigate, secondaryRoute, baseRoute, showSecondary, location])

	return showSecondary
}
