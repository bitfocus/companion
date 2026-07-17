import type { SomeEntityModel } from './EntityModel.js'

/**
 * The persisted model for a "page" control.
 *
 * A page control is a non-grid control (like triggers and expression-variables) that exists once per
 * page and owns that page's local variables. The variables are exposed to the rest of the page as
 * `$(page:varname)`.
 *
 * The model is intentionally minimal and extensible: a likely future step is to fold more of the page
 * object (name, and perhaps the grid itself) into this control, which can be done additively.
 */
export interface PageControlModel {
	readonly type: 'page'

	/** The variables owned by this page, stored as `Value`-subtype feedback entities (same as a control's own local variables). */
	localVariables: SomeEntityModel[]
}
