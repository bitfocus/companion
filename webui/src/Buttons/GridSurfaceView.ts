import type { AspectRatio } from '@companion-app/shared/Graphics/AspectRatio.js'
import type { ResolvedSurfaceControl } from '@companion-app/shared/SurfaceLayout.js'

/**
 * What the grid needs to know to draw itself as a surface rather than as itself.
 *
 * Only the drawing half of a resolved layout: the bounds it was cropped to have already become the
 * grid's own bounds by the time this reaches the grid, and everything else about the selection - which
 * surface it is, whether it can be found - belongs to the controller rather than to a cell.
 */
export interface GridSurfaceView {
	/** The controls by `row/column`. A cell of the grid which is not in here is not a control at all. */
	controlsByCell: ReadonlyMap<string, ResolvedSurfaceControl>
	/** The shape every cell is drawn at */
	aspectRatio: AspectRatio
}
