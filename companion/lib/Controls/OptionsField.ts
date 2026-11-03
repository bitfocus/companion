import type z from 'zod'
import { BANNED_PROPS } from '@companion-app/shared/Expressions.js'
import type { KeyValueChange } from '@companion-app/shared/Util/KeyValue.js'

/**
 * Check a change to one option of a control against the control's options schema
 * @returns the new options, or null when the key is not an option or the value is not valid for it
 */
export function parseOptionsField<TOptions extends object>(
	schema: z.ZodType<TOptions>,
	options: TOptions,
	change: KeyValueChange<TOptions>
): TOptions | null {
	const key = String(change.key)
	if (BANNED_PROPS.has(key)) throw new Error(`Setting option "${key}" is not allowed`)

	const result = schema.safeParse({ ...options, [key]: change.value })
	if (!result.success) return null

	// The schema drops a key that is not an option
	if (change.value !== undefined && !Object.hasOwn(result.data, key)) return null

	return result.data
}
