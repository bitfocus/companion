/**
 * How long something has been running for, such as `45s`, `3m 05s` or `1h 02m`
 */
export function formatElapsed(ms: number): string {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000))
	const hours = Math.floor(totalSeconds / 3600)
	const minutes = Math.floor((totalSeconds % 3600) / 60)
	const seconds = totalSeconds % 60

	if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`
	if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`
	return `${seconds}s`
}
