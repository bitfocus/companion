import type { SomeEntityModel } from './EntityModel.js'

/**
 * The persisted model for a "page" control - a non-grid control that exists once per page and owns
 * that page's local variables (exposed to the page as `$(page:varname)`).
 */
export interface PageControlModel {
	readonly type: 'page'

	/** The variables owned by this page, stored as `Value`-subtype feedback entities (same as a control's own local variables). */
	localVariables: SomeEntityModel[]
}
