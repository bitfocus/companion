import z from 'zod'
import { JsonObjectSchema } from './Options.js'

export const EventInstanceSchema = z.object({
	id: z.string(),
	type: z.string(),
	/** An event saved without it was treated as disabled */
	enabled: z.boolean().default(false),
	headline: z.string().optional(),
	options: JsonObjectSchema.default(() => ({})),
})

export type EventInstance = z.output<typeof EventInstanceSchema>
