import type {
	ClientSurfaceLayoutItem,
	ClientSurfaceModelItem,
	GridSize,
	SurfaceModelsUpdate,
	SurfaceRotation,
	SurfaceSchemaLayoutDefinition,
} from '@companion-app/shared/Model/Surfaces.js'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import {
	panelGridSizeFromLayout,
	resolveSurfaceView,
	type ResolvedSurfaceView,
	type SurfaceGridPlacement,
} from '@companion-app/shared/SurfaceLayout.js'

/** Which surface the grid is being viewed as. A surface brings its own placement; a model does not. */
export type GridViewAsSelection =
	| { type: 'surface'; surfaceId: string }
	// A model a plugin can drive, plugged in or not; its offset is the user's to set
	| { type: 'surfaceModel'; modelId: string; offset: { rows: number; columns: number } }

export interface GridViewAsState {
	/** Kept apart from the selection so toggling off and on returns to the same surface */
	enabled: boolean
	selection: GridViewAsSelection | null
}

export const GRID_VIEW_AS_STORAGE_KEY = 'grid-view-as'

/** How far a surface may be pushed around the grid by hand */
export const GRID_VIEW_AS_OFFSET_LIMIT = 999

export const DEFAULT_GRID_VIEW_AS_STATE: GridViewAsState = {
	enabled: false,
	selection: null,
}

/** Read back what was stored, treating anything unrecognisable as the view being off. */
export function parseStoredGridViewAs(raw: unknown): GridViewAsState {
	if (!raw || typeof raw !== 'object') return DEFAULT_GRID_VIEW_AS_STATE

	const stored = raw as Partial<GridViewAsState>

	// An unreadable selection drops to null, keeping whatever the toggle was
	return { enabled: stored.enabled === true, selection: parseStoredSelection(stored.selection) }
}

function parseStoredSelection(raw: unknown): GridViewAsSelection | null {
	if (!raw || typeof raw !== 'object') return null

	const selection = raw as Partial<GridViewAsSelection> & Record<string, unknown>

	if (selection.type === 'surface') {
		return typeof selection.surfaceId === 'string' && selection.surfaceId
			? { type: 'surface', surfaceId: selection.surfaceId }
			: null
	}

	if (selection.type === 'surfaceModel') {
		if (typeof selection.modelId !== 'string' || !selection.modelId) return null

		return { type: 'surfaceModel', modelId: selection.modelId, offset: parseStoredOffset(selection.offset) }
	}

	return null
}

function parseStoredOffset(raw: unknown): { rows: number; columns: number } {
	const offset = raw as { rows?: unknown; columns?: unknown } | undefined

	return { rows: clampOffset(offset?.rows), columns: clampOffset(offset?.columns) }
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

/** What the view amounts to now - a selection can outlive the surface or model it names. */
export type GridViewAsResolution =
	| { status: 'off' }
	/** The view is on, but nothing has been chosen for it to show */
	| { status: 'noSelection' }
	| { status: 'unknownSurface' }
	| { status: 'noLayout'; displayName: string }
	/** The surface would sit entirely outside the grid, so there is nothing of it to show */
	| { status: 'offGrid'; displayName: string }
	| {
			status: 'ready'
			displayName: string
			view: ResolvedSurfaceView
			/** What the grid should show: the surface's own bounds, kept inside the grid's */
			bounds: UserConfigGridSize
			/** Whether part of the surface hangs off the grid, and so is not being shown */
			partlyOffGrid: boolean
	  }

/**
 * Work out what the grid should show. `layouts`/`placements` are keyed by surface id; `models` is
 * what the plugins declare, plugged in or not.
 */
export function resolveGridViewAs(
	state: GridViewAsState,
	layouts: ReadonlyMap<string, ClientSurfaceLayoutItem>,
	models: ReadonlyMap<string, ClientSurfaceModelItem>,
	placements: ReadonlyMap<string, KnownSurfacePlacement>,
	gridSize: UserConfigGridSize
): GridViewAsResolution {
	if (!state.enabled) return { status: 'off' }
	if (!state.selection) return { status: 'noSelection' }

	if (state.selection.type === 'surface') {
		const { surfaceId } = state.selection

		const placement = placements.get(surfaceId)
		if (!placement) return { status: 'unknownSurface' }

		const layout = layouts.get(surfaceId)
		if (!layout) return { status: 'noLayout', displayName: placement.displayName }

		return resolvedFromLayout(
			placement.displayName,
			layout.layout,
			{
				offset: placement.offset,
				rotation: placement.rotation,
				panelGridSize: placement.panelGridSize ?? panelGridSizeFromLayout(layout.layout),
			},
			gridSize
		)
	}

	const { modelId, offset } = state.selection

	const model = models.get(modelId)
	// The plugin which declared it may have been stopped or uninstalled since it was chosen
	if (!model) return { status: 'noLayout', displayName: modelId }

	return resolvedForModel(model.name, model.layout, offset, gridSize)
}

/** A model which is not here: placed as drawn (no rotation), the user choosing only its offset. */
function resolvedForModel(
	displayName: string,
	layout: SurfaceSchemaLayoutDefinition,
	offset: { rows: number; columns: number },
	gridSize: UserConfigGridSize
): GridViewAsResolution {
	return resolvedFromLayout(
		displayName,
		layout,
		{ offset, rotation: 0, panelGridSize: panelGridSizeFromLayout(layout) },
		gridSize
	)
}

function resolvedFromLayout(
	displayName: string,
	layout: SurfaceSchemaLayoutDefinition,
	placement: SurfaceGridPlacement,
	gridSize: UserConfigGridSize
): GridViewAsResolution {
	const view = resolveSurfaceView(layout, placement)
	if (!view) return { status: 'noLayout', displayName }

	// Clip to the grid; the part beyond it is not cells at all, but what remains is still worth showing
	const bounds: UserConfigGridSize = {
		minRow: Math.max(view.gridBounds.minRow, gridSize.minRow),
		maxRow: Math.min(view.gridBounds.maxRow, gridSize.maxRow),
		minColumn: Math.max(view.gridBounds.minColumn, gridSize.minColumn),
		maxColumn: Math.min(view.gridBounds.maxColumn, gridSize.maxColumn),
	}
	if (bounds.minRow > bounds.maxRow || bounds.minColumn > bounds.maxColumn) {
		return { status: 'offGrid', displayName }
	}

	const partlyOffGrid =
		bounds.minRow !== view.gridBounds.minRow ||
		bounds.maxRow !== view.gridBounds.maxRow ||
		bounds.minColumn !== view.gridBounds.minColumn ||
		bounds.maxColumn !== view.gridBounds.maxColumn

	return { status: 'ready', displayName, view, bounds, partlyOffGrid }
}

/** A model offered in the dropdown. `selector` is how the choice is stored once picked. */
export interface GridViewAsModelChoice {
	id: string
	label: string
	selector: { type: 'surfaceModel'; modelId: string }
}

/** The models the loaded plugins declare, sorted by name, for programming a surface before it arrives. */
export function surfaceModelChoices(models: ReadonlyMap<string, ClientSurfaceModelItem>): GridViewAsModelChoice[] {
	const choices: GridViewAsModelChoice[] = []

	for (const model of models.values()) {
		choices.push({
			id: `model:${model.id}`,
			label: model.name,
			selector: { type: 'surfaceModel', modelId: model.id },
		})
	}

	return choices.sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id))
}

/** Apply surface-model diff ops to the map. Returns the same map on a no-op, to avoid a re-render. */
export function applySurfaceModelChanges(
	current: Record<string, ClientSurfaceModelItem>,
	changes: SurfaceModelsUpdate[]
): Record<string, ClientSurfaceModelItem> {
	let next = current

	for (const change of changes) {
		switch (change.type) {
			case 'init':
				next = { ...change.models }
				break
			case 'replace':
				next = { ...next, [change.itemId]: change.info }
				break
			case 'remove':
				if (!(change.itemId in next)) break
				next = { ...next }
				delete next[change.itemId]
				break
		}
	}

	return next
}

/** Which of the choices a selection names, or null when it names none of them */
export function findSurfaceModelChoice(
	choices: readonly GridViewAsModelChoice[],
	selection: GridViewAsSelection | null
): GridViewAsModelChoice | null {
	if (selection?.type !== 'surfaceModel') return null

	return choices.find((choice) => choice.selector.modelId === selection.modelId) ?? null
}
