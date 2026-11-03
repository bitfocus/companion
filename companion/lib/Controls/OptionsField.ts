import type { JsonValue } from 'type-fest'
import type z from 'zod'
import { BANNED_PROPS } from '@companion-app/shared/Expressions.js'

/**
 * Check setting one option of a control against the control's options schema
 * @returns the key and the new options, or null when the key is not an option or the value is not valid for it
 */
export function parseOptionsField<TOptions extends object>(
	schema: z.ZodType<TOptions>,
	options: TOptions,
	key: string,
	value: JsonValue | undefined
): { key: keyof TOptions & string; options: TOptions } | null {
	if (BANNED_PROPS.has(key)) throw new Error(`Setting option "${key}" is not allowed`)

	const result = schema.safeParse({ ...options, [key]: value })
	if (!result.success) return null

	// The schema drops a key that is not an option
	if (value !== undefined && !Object.hasOwn(result.data, key)) return null

	return { key: key as keyof TOptions & string, options: result.data }
}
