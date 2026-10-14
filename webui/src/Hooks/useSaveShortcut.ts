import { useEffect } from 'react'

/** Call `onSave` on Cmd+S / Ctrl+S, instead of the browser saving the page. */
export function useSaveShortcut(onSave: () => void): void {
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === 's') {
				e.preventDefault()
				onSave()
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [onSave])
}
