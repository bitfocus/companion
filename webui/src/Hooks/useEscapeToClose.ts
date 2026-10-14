import { useEffect } from 'react'

/**
 * Call `onClose` when Escape is pressed anywhere on the page, while `enabled`.
 * Focused controls and open dialogs get to consume Escape themselves first.
 */
export function useEscapeToClose(enabled: boolean, onClose: () => void): void {
	useEffect(() => {
		if (!enabled) return

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key !== 'Escape' || e.defaultPrevented) return

			const target = e.target instanceof Element ? e.target : null
			if (
				document.querySelector('[role="dialog"]') ||
				target?.closest('input, textarea, select, [contenteditable="true"], [role="listbox"], [role="combobox"]')
			)
				return

			onClose()
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [enabled, onClose])
}
