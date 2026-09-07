import { reduceAspectRatio, type AspectRatio } from './Graphics/AspectRatio.js'
import {
	clampPreviewRenderSize,
	DEFAULT_PREVIEW_RENDER_SIZE,
	PREVIEW_RENDER_SIZE,
	PREVIEW_RENDER_SIZE_MAX,
	type PreviewRenderSize,
} from './Model/Preview.js'
import type {
	GridSize,
	SurfaceLayoutBitmapSize,
	SurfaceRotation,
	SurfaceSchemaControlDefinition,
	SurfaceSchemaControlStylePreset,
	SurfaceSchemaLayoutDefinition,
} from './Model/Surfaces.js'
import type { UserConfigGridSize } from './Model/UserConfigModel.js'

/**
 * The style a control is drawn with: its named preset if it has one, otherwise the required default preset.
 * An unknown preset name falls back to the default, matching how the panels resolve their own controls.
 */
export function resolveControlStylePreset(
	layout: SurfaceSchemaLayoutDefinition,
	control: SurfaceSchemaControlDefinition
): SurfaceSchemaControlStylePreset {
	if (control.stylePreset) {
		const preset = layout.stylePresets[control.stylePreset]
		if (preset) return preset
	}

	return layout.stylePresets.default
}

/** Where a surface sits on the grid, and which way up */
export interface SurfaceGridPlacement {
	/** How far right and down the surface's own origin is on the grid */
	offset: { rows: number; columns: number }
	rotation: SurfaceRotation
	/**
	 * The surface's own grid size, as it reports it - before rotation. Needed because a rotated surface's controls
	 * are mirrored about the axis they turned around, which can only be done knowing how big that axis is.
	 */
	panelGridSize: GridSize
}

/** One control of a surface, placed on the grid */
export interface ResolvedSurfaceControl {
	/** The control's id in the layout, which is stable and unique within the surface */
	id: string
	/** Absolute grid coordinates, not relative to the view */
	row: number
	column: number
	/**
	 * The shape this control is drawn at, or null when its style declares no bitmap at all - an encoder which only
	 * has leds, or a text-only display. Those still occupy a cell, but have no shape of their own to be drawn at.
	 */
	aspectRatio: AspectRatio | null
	/** The pixel size to draw a preview of this control at */
	renderSize: PreviewRenderSize
}

/**
 * A surface's layout, resolved onto the grid.
 *
 * A discriminated union with one member for now: the schema describes controls by row and column only, so a grid
 * is all it can express. Per-control pixel geometry needs a schema change first, and would arrive here as another
 * variant rather than by widening this one.
 */
export type ResolvedSurfaceView = ResolvedSurfaceGridView

export interface ResolvedSurfaceGridView {
	type: 'grid'
	/** The smallest rectangle of the grid containing every control */
	bounds: UserConfigGridSize
	/** Every control, in no particular order */
	controls: ResolvedSurfaceControl[]
	/** The controls by `row/column`, for asking whether a cell of the bounding box is a control at all */
	controlsByCell: ReadonlyMap<string, ResolvedSurfaceControl>
	/**
	 * The shape every cell of the view is drawn at: whichever shape the most controls have. Controls of another
	 * shape are letterboxed into it rather than the rows being sized individually.
	 */
	aspectRatio: AspectRatio
	/** The size a cell of the view's own shape is drawn at */
	renderSize: PreviewRenderSize
	/** Whether any control is drawn at a shape other than the view's, and so is letterboxed into its cell */
	hasMixedAspectRatios: boolean
}

/** The key `controlsByCell` is indexed by */
export function surfaceCellKey(row: number, column: number): string {
	return `${row}/${column}`
}

/**
 * Rotate a coordinate of the grid into the panel's own coordinates, and back.
 *
 * `gridSize` is the surface's size as the grid sees it, which for a quarter turn is the panel's own size with the
 * rows and columns swapped.
 */
export function rotateXYForPanel(
	x: number,
	y: number,
	gridSize: GridSize,
	rotation: SurfaceRotation
): [number, number] {
	switch (rotation) {
		case 'surface90':
			return [y, gridSize.columns - x - 1]
		case 'surface-90':
			return [gridSize.rows - y - 1, x]
		case 'surface180':
			return [gridSize.columns - x - 1, gridSize.rows - y - 1]
		default:
			return [x, y]
	}
}

export function unrotateXYForPanel(
	x: number,
	y: number,
	gridSize: GridSize,
	rotation: SurfaceRotation
): [number, number] {
	switch (rotation) {
		case 'surface90':
			return [gridSize.columns - y - 1, x]
		case 'surface-90':
			return [y, gridSize.rows - x - 1]
		case 'surface180':
			return [gridSize.columns - x - 1, gridSize.rows - y - 1]
		default:
			return [x, y]
	}
}

/** The surface's size as the grid sees it: a quarter turn swaps the rows and columns over */
export function rotatedPanelGridSize(panelGridSize: GridSize, rotation: SurfaceRotation): GridSize {
	if (rotation === 'surface90' || rotation === 'surface-90' || rotation === 90 || rotation === -90) {
		return { rows: panelGridSize.columns, columns: panelGridSize.rows }
	}

	return panelGridSize
}

/**
 * One scale for the whole surface, so that the sizes its controls are drawn at keep the proportions the device
 * has: the touch strip of a Stream Deck +XL is twice as wide as a button, and stays twice as wide here.
 *
 * Chosen so that the least detailed control is drawn at least as large as an ordinary button preview, which is
 * what the grid needs to stay sharp when zoomed in - and then capped, so that a surface which also has a large
 * display on it does not turn that into an enormous render.
 */
export function surfaceRenderScale(bitmaps: readonly SurfaceLayoutBitmapSize[]): number {
	const longSides = bitmaps.map((bitmap) => Math.max(bitmap.w, bitmap.h)).filter((side) => side > 0)
	if (longSides.length === 0) return 1

	const scale = Math.max(1, PREVIEW_RENDER_SIZE / Math.min(...longSides))

	return Math.min(scale, PREVIEW_RENDER_SIZE_MAX / Math.max(...longSides))
}

/**
 * Which shape the view as a whole is drawn at: the one the most controls have.
 *
 * Grouped by shape rather than by pixel size, so a surface whose buttons are 72x72 and whose secondary display is
 * 120x120 is all one shape. Controls with no bitmap have no shape to vote with, but still occupy a cell and are
 * drawn at whatever wins.
 *
 * Ties go to the default preset's shape, and failing that to the first when sorted - never to whichever the
 * object happened to be iterated in, or the same surface would be drawn differently between restarts.
 */
export function chooseViewAspectRatio(
	controlRatios: readonly (AspectRatio | null)[],
	defaultRatio: AspectRatio | null
): AspectRatio {
	const counts = new Map<string, { ratio: AspectRatio; count: number }>()

	for (const ratio of controlRatios) {
		if (!ratio) continue

		const key = `${ratio.w}:${ratio.h}`
		const existing = counts.get(key)
		if (existing) existing.count++
		else counts.set(key, { ratio, count: 1 })
	}

	if (counts.size === 0) return defaultRatio ?? { w: 1, h: 1 }

	const candidates = Array.from(counts.entries()).sort(([keyA, a], [keyB, b]) => {
		if (a.count !== b.count) return b.count - a.count

		// A tie the default preset is part of is settled by it, so the surface's own idea of normal wins
		if (defaultRatio) {
			const defaultKey = `${defaultRatio.w}:${defaultRatio.h}`
			if (keyA === defaultKey) return -1
			if (keyB === defaultKey) return 1
		}

		return keyA.localeCompare(keyB)
	})

	return candidates[0][1].ratio
}

/**
 * Place a surface's layout onto the grid.
 *
 * Returns null when the layout describes no controls at all, which is not a surface anything can be viewed as.
 */
export function resolveSurfaceGridView(
	layout: SurfaceSchemaLayoutDefinition,
	placement: SurfaceGridPlacement
): ResolvedSurfaceGridView | null {
	const gridSizeOfSurface = rotatedPanelGridSize(placement.panelGridSize, placement.rotation)

	const bitmaps: SurfaceLayoutBitmapSize[] = []
	for (const control of Object.values(layout.controls)) {
		const bitmap = resolveControlStylePreset(layout, control).bitmap
		if (bitmap) bitmaps.push(bitmap)
	}
	const scale = surfaceRenderScale(bitmaps)

	const controls: ResolvedSurfaceControl[] = []
	const controlsByCell = new Map<string, ResolvedSurfaceControl>()

	for (const [id, control] of Object.entries(layout.controls)) {
		// The layout is in the panel's own coordinates, which a rotated surface does not share with the grid
		const [gridX, gridY] = unrotateXYForPanel(control.column, control.row, gridSizeOfSurface, placement.rotation)

		const bitmap = resolveControlStylePreset(layout, control).bitmap
		const resolved: ResolvedSurfaceControl = {
			id,
			row: gridY + placement.offset.rows,
			column: gridX + placement.offset.columns,
			aspectRatio: bitmap ? reduceAspectRatio(bitmap.w, bitmap.h) : null,
			renderSize: bitmap
				? clampPreviewRenderSize({ width: bitmap.w * scale, height: bitmap.h * scale })
				: DEFAULT_PREVIEW_RENDER_SIZE,
		}

		controls.push(resolved)

		// Two controls on one cell is a surface describing something the grid cannot show; the first wins, so which
		// one that is does not change between renders
		const cellKey = surfaceCellKey(resolved.row, resolved.column)
		if (!controlsByCell.has(cellKey)) controlsByCell.set(cellKey, resolved)
	}

	if (controls.length === 0) return null

	const defaultBitmap = layout.stylePresets.default.bitmap
	const aspectRatio = chooseViewAspectRatio(
		controls.map((control) => control.aspectRatio),
		defaultBitmap ? reduceAspectRatio(defaultBitmap.w, defaultBitmap.h) : null
	)

	// The cell's own size comes from a control of the chosen shape, so the view is drawn at a size the surface
	// actually uses rather than one derived from the shape alone
	const matching = controls.find(
		(control) =>
			control.aspectRatio && control.aspectRatio.w === aspectRatio.w && control.aspectRatio.h === aspectRatio.h
	)

	return {
		type: 'grid',
		bounds: {
			minRow: Math.min(...controls.map((control) => control.row)),
			maxRow: Math.max(...controls.map((control) => control.row)),
			minColumn: Math.min(...controls.map((control) => control.column)),
			maxColumn: Math.max(...controls.map((control) => control.column)),
		},
		controls,
		controlsByCell,
		aspectRatio,
		renderSize: matching?.renderSize ?? DEFAULT_PREVIEW_RENDER_SIZE,
		hasMixedAspectRatios: controls.some(
			(control) =>
				control.aspectRatio && (control.aspectRatio.w !== aspectRatio.w || control.aspectRatio.h !== aspectRatio.h)
		),
	}
}
