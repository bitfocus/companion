import type { ClientSurfaceLayoutItem, GridSize, SurfaceRotation } from '@companion-app/shared/Model/Surfaces.js'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import {
	panelGridSizeFromLayout,
	resolveSurfaceGridView,
	type ResolvedSurfaceGridView,
	type SurfaceGridPlacement,
} from '@companion-app/shared/SurfaceLayout.js'

/**
 * Which surface the grid is being viewed as.
 *
 * A surface which exists brings its own placement - where it sits on the grid and which way up - so
 * there is nothing to choose. A type of surface is one nothing has told us where to put, which is the
 * point of it: it is for programming for a surface which is not here yet, so the offsets are the
 * user's to set.
 */
export type GridViewAsSelection =
	| { type: 'surface'; surfaceId: string }
	| { type: 'surfaceType'; surfaceType: string; offset: { rows: number; columns: number } }

export interface GridViewAsState {
	/**
	 * Whether the view is being applied. Kept apart from the selection so that turning it off and on
	 * again comes back to the same surface rather than to nothing.
	 */
	enabled: boolean
	selection: GridViewAsSelection
}

export const GRID_VIEW_AS_STORAGE_KEY = 'grid-view-as'

/** How far a surface may be pushed around the grid by hand. Well past any grid anyone has. */
export const GRID_VIEW_AS_OFFSET_LIMIT = 999

export const DEFAULT_GRID_VIEW_AS_STATE: GridViewAsState = {
	enabled: false,
	selection: { type: 'surfaceType', surfaceType: '', offset: { rows: 0, columns: 0 } },
}

/**
 * Read back what was stored, treating anything unrecognisable as nothing at all.
 *
 * What is in local storage was written by some earlier version of this, or by hand, so nothing here
 * may assume it is the shape it was written in: a view which cannot be understood must come back as
 * the view being off, never as a crash on a page which is otherwise fine.
 */
export function parseStoredGridViewAs(raw: unknown): GridViewAsState {
	if (!raw || typeof raw !== 'object') return DEFAULT_GRID_VIEW_AS_STATE

	const stored = raw as Partial<GridViewAsState>
	const selection = parseStoredSelection(stored.selection)
	if (!selection) return DEFAULT_GRID_VIEW_AS_STATE

	return { enabled: stored.enabled === true, selection }
}

function parseStoredSelection(raw: unknown): GridViewAsSelection | null {
	if (!raw || typeof raw !== 'object') return null

	const selection = raw as Partial<GridViewAsSelection> & Record<string, unknown>

	if (selection.type === 'surface') {
		return typeof selection.surfaceId === 'string' && selection.surfaceId
			? { type: 'surface', surfaceId: selection.surfaceId }
			: null
	}

	if (selection.type === 'surfaceType') {
		if (typeof selection.surfaceType !== 'string') return null

		const offset = selection.offset as { rows?: unknown; columns?: unknown } | undefined
		return {
			type: 'surfaceType',
			surfaceType: selection.surfaceType,
			offset: {
				rows: clampOffset(offset?.rows),
				columns: clampOffset(offset?.columns),
			},
		}
	}

	return null
}

function clampOffset(value: unknown): number {
	const offset = Number(value)
	if (!isFinite(offset)) return 0

	return Math.min(GRID_VIEW_AS_OFFSET_LIMIT, Math.max(-GRID_VIEW_AS_OFFSET_LIMIT, Math.round(offset)))
}

/** Where a surface which is known to Companion sits on the grid, and which way up it is mounted */
export interface KnownSurfacePlacement {
	displayName: string
	offset: { rows: number; columns: number }
	rotation: SurfaceRotation
	/** The surface's own grid size, before rotation, when it has reported one */
	panelGridSize: GridSize | null
}

/**
 * What the view amounts to right now.
 *
 * A selection can outlive what it names - a surface can be forgotten while it is being viewed as, and
 * a layout is only known for a surface which has been plugged in at least once - so this says which
 * of those happened rather than quietly showing the whole grid and leaving the user to wonder.
 */
export type GridViewAsResolution =
	| { status: 'off' }
	| { status: 'unknownSurface' }
	| { status: 'noLayout'; displayName: string }
	/** The surface would sit entirely outside the grid, so there is nothing of it to show */
	| { status: 'offGrid'; displayName: string }
	| {
			status: 'ready'
			displayName: string
			view: ResolvedSurfaceGridView
			/** What the grid should show: the surface's own bounds, kept inside the grid's */
			bounds: UserConfigGridSize
			/** Whether part of the surface hangs off the grid, and so is not being shown */
			partlyOffGrid: boolean
	  }

/**
 * Work out what the grid should show.
 *
 * `layouts` and `placements` are what Companion currently knows, both keyed by surface id; a
 * selection naming something which is in neither is what the unknown states are for.
 */
export function resolveGridViewAs(
	state: GridViewAsState,
	layouts: ReadonlyMap<string, ClientSurfaceLayoutItem>,
	placements: ReadonlyMap<string, KnownSurfacePlacement>,
	gridSize: UserConfigGridSize
): GridViewAsResolution {
	if (!state.enabled) return { status: 'off' }

	if (state.selection.type === 'surface') {
		const { surfaceId } = state.selection

		const placement = placements.get(surfaceId)
		if (!placement) return { status: 'unknownSurface' }

		const layout = layouts.get(surfaceId)
		if (!layout) return { status: 'noLayout', displayName: placement.displayName }

		return resolved(
			placement.displayName,
			layout,
			{
				offset: placement.offset,
				rotation: placement.rotation,
				panelGridSize: placement.panelGridSize ?? panelGridSizeFromLayout(layout.layout),
			},
			gridSize
		)
	}

	const { surfaceType, offset } = state.selection

	// Any surface of this type will do - what is being viewed as is the model, not the one that was
	// plugged in to teach Companion what it looks like
	const layout = findLayoutForSurfaceType(layouts, surfaceType)
	if (!layout) return { status: 'noLayout', displayName: surfaceType || 'Custom' }

	// A surface which is not here is not mounted any particular way up, so it is placed as it is drawn
	return resolved(
		layout.type,
		layout,
		{ offset, rotation: 0, panelGridSize: panelGridSizeFromLayout(layout.layout) },
		gridSize
	)
}

function resolved(
	displayName: string,
	layout: ClientSurfaceLayoutItem,
	placement: SurfaceGridPlacement,
	gridSize: UserConfigGridSize
): GridViewAsResolution {
	const view = resolveSurfaceGridView(layout.layout, placement)
	if (!view) return { status: 'noLayout', displayName }

	// A surface can be positioned - or offset by hand - so that some or all of it is beyond the grid.
	// The part which is there is still worth showing; the cells beyond it are not cells at all.
	const bounds: UserConfigGridSize = {
		minRow: Math.max(view.bounds.minRow, gridSize.minRow),
		maxRow: Math.min(view.bounds.maxRow, gridSize.maxRow),
		minColumn: Math.max(view.bounds.minColumn, gridSize.minColumn),
		maxColumn: Math.min(view.bounds.maxColumn, gridSize.maxColumn),
	}
	if (bounds.minRow > bounds.maxRow || bounds.minColumn > bounds.maxColumn) {
		return { status: 'offGrid', displayName }
	}

	const partlyOffGrid =
		bounds.minRow !== view.bounds.minRow ||
		bounds.maxRow !== view.bounds.maxRow ||
		bounds.minColumn !== view.bounds.minColumn ||
		bounds.maxColumn !== view.bounds.maxColumn

	return { status: 'ready', displayName, view, bounds, partlyOffGrid }
}

function findLayoutForSurfaceType(
	layouts: ReadonlyMap<string, ClientSurfaceLayoutItem>,
	surfaceType: string
): ClientSurfaceLayoutItem | null {
	if (!surfaceType) return null

	for (const layout of layouts.values()) {
		if (layout.type === surfaceType) return layout
	}

	return null
}

/**
 * The types of surface which can be viewed as, sorted by name.
 *
 * Only the ones Companion has a layout for, which today means the ones which have been plugged in at
 * some point: a surface module describes its layout when a device opens, so a model nobody here has
 * ever owned is not something we can draw. Surface modules cannot yet list the layouts they know
 * about without a device, so this list is as long as the user's own history and no longer.
 */
export function surfaceTypeChoicesFromLayouts(
	layouts: ReadonlyMap<string, ClientSurfaceLayoutItem>
): { id: string; label: string }[] {
	const types = new Set<string>()
	for (const layout of layouts.values()) types.add(layout.type)

	return Array.from(types)
		.sort((a, b) => a.localeCompare(b))
		.map((type) => ({ id: type, label: type }))
}
