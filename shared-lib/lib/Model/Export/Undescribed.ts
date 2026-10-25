import z from 'zod'

/** The description that marks a part of the export format as not described yet */
export const UNDESCRIBED = 'Not described yet'

/**
 * A part of the export format that isn't described yet, which accepts anything. Describing it later doesn't change the
 * format, only says what it already is, so the snapshot test allows it to become any schema
 */
export function undescribed(): z.ZodAny {
	return z.any().describe(UNDESCRIBED)
}
