import z from 'zod'
import { SomeEntityModelSchema } from './EntityModel.js'

/**
 * The persisted model for a "page" control - a non-grid control that exists once per page and owns
 * that page's local variables (exposed to the page as `$(page:varname)`).
 */
export const PageControlModelSchema = z.object({
	type: z.literal('page'),

	/** The variables owned by this page, stored as `Value`-subtype feedback entities (same as a control's own local variables). */
	localVariables: z.array(SomeEntityModelSchema).default(() => []),
})

export type PageControlModel = z.output<typeof PageControlModelSchema>
