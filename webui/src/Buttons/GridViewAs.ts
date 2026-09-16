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
	// A model a plugin can drive, plugged in or not; its offset is the user's to set
	| { type: 'surfaceModel'; modelId: string; offset: { rows: number; columns: number } }
	/** A model Companion only knows because one was plugged in, named by what that surface called itself */
	| { type: 'surfaceType'; surfaceType: string; offset: { rows: number; columns: number } }

export interface GridViewAsState {
	/** Kept apart from the selection so toggling off and on returns to the same surface */
	enabled: boolean
	selection: GridViewAsSelection | null
}

export const GRID_VIEW_AS_STORAGE_KEY = 'grid-view-as'

/** `ClientSurfaceItem.integrationType` of the built-in emulators */
const EMULATOR_INTEGRATION_TYPE = 'emulator'

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

	if (selection.type === 'surfaceType') {
		if (typeof selection.surfaceType !== 'string' || !selection.surfaceType) return null

		return { type: 'surfaceType', surfaceType: selection.surfaceType, offset: parseStoredOffset(selection.offset) }
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

	if (state.selection.type === 'surfaceModel') {
		const { modelId, offset } = state.selection

		const model = models.get(modelId)
		// The plugin which declared it may have been stopped or uninstalled since it was chosen
		if (!model) return { status: 'noLayout', displayName: modelId }

		return resolvedForModel(model.name, model.layout, offset, gridSize)
	}

	const { surfaceType, offset } = state.selection

	// Any surface of this type will do - what is being viewed as is the model, not the one that was
	// plugged in to teach Companion what it looks like
	const layout = findLayoutForSurfaceType(layouts, surfaceType)
	if (!layout) return { status: 'noLayout', displayName: surfaceType }

	return resolvedForModel(layout.type, layout.layout, offset, gridSize)
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
 * A model of surface which can be viewed as, whether or not one is here.
 *
 * The dropdown only needs an id and a label; `selector` is how the choice is written down once it is
 * picked, and keeps the two kinds apart - a model a plugin declared and a name a surface once called
 * itself are different things, resolved against different places.
 */
export interface GridViewAsModelChoice {
	id: string
	label: string
	selector: { type: 'surfaceModel'; modelId: string } | { type: 'surfaceType'; surfaceType: string }
}

/**
 * The models of surface which can be viewed as, sorted by name.
 *
 * Two sources, because plugins are not all able to say the same things. A plugin which knows the
 * models it drives declares them, so they can be programmed for before one is bought. A plugin which
 * cannot - Satellite, where the surface on the other end describes itself when it arrives - leaves
 * only the models Companion has actually seen, and those are offered too, so this is never shorter
 * than it used to be.
 *
 * A declared model wins over a seen one of the same name: they are the same device, and the plugin's
 * own description of it is the one that does not depend on what happened to be plugged in.
 *
 * Emulators are left out. An emulator is not a model anyone is programming ahead for - it is a
 * window on this machine, whose layout is whatever its own grid size was last set to - so offering
 * one here would be offering a shape rather than a device. Viewing as a particular emulator, which
 * does have a place on the grid, is still offered alongside the real surfaces.
 */
export function surfaceModelChoices(
	models: ReadonlyMap<string, ClientSurfaceModelItem>,
	layouts: ReadonlyMap<string, ClientSurfaceLayoutItem>
): GridViewAsModelChoice[] {
	const choices: GridViewAsModelChoice[] = []
	const declaredNames = new Set<string>()

	for (const model of models.values()) {
		declaredNames.add(model.name)
		choices.push({
			id: `model:${model.id}`,
			label: model.name,
			selector: { type: 'surfaceModel', modelId: model.id },
		})
	}

	const seenTypes = new Set<string>()
	for (const layout of layouts.values()) {
		if (layout.integrationType === EMULATOR_INTEGRATION_TYPE) continue
		if (declaredNames.has(layout.type)) continue

		seenTypes.add(layout.type)
	}

	for (const type of seenTypes) {
		choices.push({ id: `type:${type}`, label: type, selector: { type: 'surfaceType', surfaceType: type } })
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
	if (!selection) return null

	for (const choice of choices) {
		if (choice.selector.type !== selection.type) continue

		if (choice.selector.type === 'surfaceModel' && selection.type === 'surfaceModel') {
			if (choice.selector.modelId === selection.modelId) return choice
		} else if (choice.selector.type === 'surfaceType' && selection.type === 'surfaceType') {
			if (choice.selector.surfaceType === selection.surfaceType) return choice
		}
	}

	return null
}
