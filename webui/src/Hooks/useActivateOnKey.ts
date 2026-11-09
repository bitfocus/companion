import { useCallback } from 'react'

/**
 * A keydown handler for an element that acts as a button (`role="button"`, `tabIndex={0}`): calls `onActivate` on
 * Enter or Space, as a click does. Keys pressed in controls inside it are left to them
 */
export function useActivateOnKey(onActivate: () => void): (e: React.KeyboardEvent) => void {
	return useCallback(
		(e: React.KeyboardEvent) => {
			if (e.target !== e.currentTarget) return
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault()
				onActivate()
			}
		},
		[onActivate]
	)
}
