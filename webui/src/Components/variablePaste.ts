/**
 * Unwrap a pasted `$(...)` variable reference down to its inner text, so pasting a whole variable
 * reference into a field fills in just the name part. When `namespace` is given, a matching
 * `namespace:` prefix is stripped too, so `$(local:foo)` becomes `foo` rather than `local:foo`.
 *
 * The pasted value is always trimmed; anything that isn't a fully-wrapped `$(...)` reference is
 * otherwise returned unchanged.
 */
export function unwrapPastedVariableReference(pastedValue: string, namespace?: string): string {
	let value = pastedValue.trim()
	if (value.length === 0) return pastedValue

	if (value.startsWith('$(') && value.endsWith(')')) {
		value = value.slice(2, -1)
		if (namespace && value.startsWith(`${namespace}:`)) {
			value = value.slice(namespace.length + 1)
		}
	}

	return value
}
