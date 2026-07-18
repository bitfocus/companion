import type { DrawStyleLayeredButtonModel } from '@companion-app/shared/Model/StyleModel.js'
import type { CompositeElementIdString } from '../Instance/Definitions.js'

/**
 * The minimal surface a control's `drawing` exposes to the rest of the application (the graphics controller and
 * the controls controller). The concrete {@link LayeredButtonDrawer} implements a much richer set of methods for
 * its owning control's internal use; only what is called externally lives here.
 */
export interface IButtonDrawer {
	/** Compute the draw style of the button. */
	getDrawStyle(): Promise<DrawStyleLayeredButtonModel>
	/** The most recently computed draw style, if any (without recomputing). */
	getLastDrawStyle(): DrawStyleLayeredButtonModel | null
	/** Propagate a variable change: invalidate affected cached elements and redraw if relevant. */
	onVariablesChanged(allChangedVariables: ReadonlySet<string>): void
	/** A composite element definition changed: invalidate and redraw if relevant. */
	onCompositeElementsChanged(allChangedElementIds: ReadonlySet<CompositeElementIdString>): void
}
