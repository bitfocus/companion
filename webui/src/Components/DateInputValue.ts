const pad = (n: number) => String(n).padStart(2, '0')

/** Format a Date as a local "YYYY-MM-DD" string (as consumed by `<input type="date">`). */
export function formatLocalDate(date: Date): string {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * Normalise a stored value for the native `<input type="date">`, which requires an exact
 * "YYYY-MM-DD" string. Legacy triggers stored an ISO datetime (the old picker emitted a `Date`); a
 * bare "YYYY-MM-DD" is passed through untouched to avoid the UTC-parsing day-shift that
 * `new Date("YYYY-MM-DD")` would introduce.
 */
export function toDateInputValue(value: string | null): string {
	if (!value) return ''
	if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
	const d = new Date(value)
	if (isNaN(d.getTime())) return ''
	return formatLocalDate(d)
}
