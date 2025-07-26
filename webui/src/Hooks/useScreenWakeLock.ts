import { useCallback, useEffect, useRef, useState } from 'react'

export interface WakeLockState {
	isSupported: boolean
	isLocked: boolean
}

/**
 * Try to keep the screen awake using the Wake Lock API, while this component is mounted.
 * It will automatically request a wake lock when the component mounts and release it when it unmounts.
 * It will also try to re-request the wake lock when the document becomes visible again.
 */
export function useWakeLock(): WakeLockState {
	const [isLocked, setIsLocked] = useState<boolean>(false)
	const wakeLock = useRef<WakeLockSentinel | null>(null)

	// https://caniuse.com/mdn-api_wakelock
	const isSupported = typeof window !== 'undefined' && 'wakeLock' in navigator

	// create an async function to request a wake lock
	const requestWakeLock = useCallback(async () => {
		try {
			wakeLock.current = await navigator.wakeLock.request('screen')

			// // listen for our release event
			wakeLock.current.addEventListener('release', () => {
				// if wake lock is released alter the button accordingly
				setIsLocked(false)
			})
		} catch (_err) {
			// It failed
		}
	}, [])

	useEffect(() => {
		if (!isSupported) return console.log('Wake Lock API not supported')

		console.log('Requesting Wake Lock')

		void requestWakeLock()

		const abort = new AbortController()

		document.addEventListener(
			'visibilitychange',
			() => {
				if (wakeLock.current === null && document.visibilityState === 'visible') {
					void requestWakeLock()
				}
			},
			{ signal: abort.signal }
		)

		return () => {
			abort.abort()

			if (wakeLock.current) {
				void wakeLock.current.release().then(() => {
					wakeLock.current = null
					setIsLocked(false)
				})
			}
		}
	}, [isSupported, requestWakeLock])

	return {
		isSupported,
		isLocked,
	}
}
