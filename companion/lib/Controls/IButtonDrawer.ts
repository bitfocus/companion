import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { SomeButtonGraphicsDrawElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import type { DrawStyleLayeredButtonModel } from '@companion-app/shared/Model/StyleModel.js'
import type { ImageResult } from '../Graphics/ImageResult.js'
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
	/** Another located control finished rendering: invalidate and redraw if this button mirrors or references it. */
	onButtonDrawn(location: ControlLocation, render: ImageResult): void
	/** Whether this button draws without a top bar, used to scale legacy (pre-5.0) feedback font sizes. */
	resolveDefaultNoTopBar(): boolean
	/**
	 * For a button drawn from images made for particular sizes (a link button), what to draw at each size instead of the
	 * elements of the draw style last computed. Null, or not implemented, to draw the draw style at every size.
	 */
	getSizedDraw?(): ButtonSizedDraw | null
}

/** What to draw for a button at each size it is drawn at */
export interface ButtonSizedDraw {
	/** Identifies what is drawn at every size, for the cache key of the render */
	readonly key: string
	/**
	 * The elements to draw at a size: of the content of the button, under its decoration, before it is turned for the
	 * surface. May wait briefly for them
	 */
	elementsAt(width: number, height: number): Promise<SomeButtonGraphicsDrawElement[]>
}
