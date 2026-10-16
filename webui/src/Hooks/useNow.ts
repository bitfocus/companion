import { useEffect, useState } from 'react'

/**
 * The current time, re-rendering every `intervalMs` so that anything derived from it (eg a relative time) stays current
 */
export function useNow(intervalMs: number): number {
	const [now, setNow] = useState(() => Date.now())

	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), intervalMs)
		return () => clearInterval(timer)
	}, [intervalMs])

	return now
}
