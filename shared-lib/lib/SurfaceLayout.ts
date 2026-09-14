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

/**
 * A rectangle on the face of a surface, in layout units.
 *
 * Layout units measure the face, not the bitmaps drawn on it: two controls of the same size can be drawn at
 * different resolutions, so a pixel count says how much detail a control has, not how big it is. Pixels to draw
 * with is `renderSize`. Only the ratios between controls matter; see `estimateControlSize` for where they come from.
 */
export interface SurfaceRect {
	x: number
	y: number
	width: number
	height: number
}

/**
 * How a control is drawn. A union so a round encoder or curved strip can arrive as another member; today the
 * schema only describes rectangles.
 */
export type SurfaceControlShape = {
	type: 'rect'
	/** As a fraction of the shorter side, so it survives being scaled */
	cornerRadiusRatio: number
}

/** Which button on the grid a control drives. A surface control is an input to a button, not a cell of a layout. */
export interface SurfaceControlCell {
	row: number
	column: number
}

/** One control of a surface: where it is, how it is drawn, and which button it drives */
export interface ResolvedSurfaceControl {
	/** The control's id in the layout, which is stable and unique within the surface */
	id: string
	/** The button this control drives, in absolute grid coordinates */
	cell: SurfaceControlCell
	/** Where the control is on the face of the surface, and how big it is there */
	bounds: SurfaceRect
	shape: SurfaceControlShape
	/** The shape of the bitmap this control is drawn with, or null when its style declares no bitmap (leds-only, text-only). */
	aspectRatio: AspectRatio | null
	/** How many pixels to draw a preview with - its resolution, a separate question to how large it is on the face. */
	renderSize: PreviewRenderSize
}

/**
 * A surface's layout, resolved into something that can be drawn.
 *
 * A flat list of placed controls, not a grid: the schema only says rows and columns today, but this describes a
 * face with controls on it, so drawing, hit-testing and navigation above never learn the positions came from a
 * lattice. When the schema can carry real positions, only `resolveSurfaceView` changes.
 */
export interface ResolvedSurfaceView {
	/** Every control of the surface, in the order the layout listed them */
	controls: readonly ResolvedSurfaceControl[]
	/** The whole face, in the same layout units as the control bounds */
	extent: { width: number; height: number }
	/**
	 * The smallest grid rectangle containing every button these controls drive - not the shape of the view, but the
	 * part of the grid it reaches, which the editor's grid-coordinate code needs.
	 */
	gridBounds: UserConfigGridSize
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

/** Whether a surface is mounted on its side, which swaps over everything measured across it */
export function isQuarterTurn(rotation: SurfaceRotation): boolean {
	return rotation === 'surface90' || rotation === 'surface-90' || rotation === 90 || rotation === -90
}

/** The surface's size as the grid sees it: a quarter turn swaps the rows and columns over */
export function rotatedPanelGridSize(panelGridSize: GridSize, rotation: SurfaceRotation): GridSize {
	if (isQuarterTurn(rotation)) return { rows: panelGridSize.columns, columns: panelGridSize.rows }

	return panelGridSize
}

/**
 * How big the surface's own grid is, worked out from where its controls are.
 *
 * A layout knows nothing about the size of the panel it describes, so this stands in when the surface itself is
 * not there to say - viewing as a type of surface rather than one that is plugged in.
 */
export function panelGridSizeFromLayout(layout: SurfaceSchemaLayoutDefinition): GridSize {
	let rows = 0
	let columns = 0

	for (const control of Object.values(layout.controls)) {
		rows = Math.max(rows, control.row + 1)
		columns = Math.max(columns, control.column + 1)
	}

	return { rows, columns }
}

/**
 * One scale for the whole surface, so controls keep the proportions the device gives them.
 *
 * Chosen so the least detailed control is drawn at least button-preview size (so the grid stays sharp zoomed in),
 * then capped so a large display on the surface doesn't turn into an enormous render.
 */
export function surfaceRenderScale(bitmaps: readonly SurfaceLayoutBitmapSize[]): number {
	const longSides = bitmaps.map((bitmap) => Math.max(bitmap.w, bitmap.h)).filter((side) => side > 0)
	if (longSides.length === 0) return 1

	const scale = Math.max(1, PREVIEW_RENDER_SIZE / Math.min(...longSides))

	return Math.min(scale, PREVIEW_RENDER_SIZE_MAX / Math.max(...longSides))
}

/** Where a surface sits on the grid, and which way up */
export interface SurfaceGridPlacement {
	/** How far right and down the surface's own origin is on the grid */
	offset: { rows: number; columns: number }
	rotation: SurfaceRotation
	/**
	 * The surface's own grid size before rotation. Needed because a rotated surface's controls are mirrored about
	 * the axis they turned around, which needs the size of that axis.
	 */
	panelGridSize: GridSize
}

/** The gap left between controls, as a fraction of the smallest control. Stands in for the bezel of a real device. */
const CONTROL_GAP_RATIO = 0.14

/** How round a control's corners are, as a fraction of its shorter side. A Stream Deck key, near enough. */
const CONTROL_CORNER_RATIO = 0.12

/** The size of a control which declares no bitmap, when the surface has nothing else to go on */
const NOMINAL_CONTROL_SIZE = 72

/**
 * How big a control is on the face, in layout units.
 *
 * The one guess in here: the schema says how many pixels a control is drawn with, nothing about its physical size,
 * so this treats a pixel as a fixed amount of face - i.e. it assumes every control has the same pixel density.
 * Real devices don't (a Stream Deck + draws its touch strip at more pixels per mm than its keys), so a strip comes
 * out wider and taller relative to a key than it really is. The shapes and ordering are right; the proportions are
 * only as good as that assumption. Best available until a layout can state a physical size per control.
 */
function estimateControlSize(
	bitmap: SurfaceLayoutBitmapSize | undefined,
	fallbackSide: number
): { width: number; height: number } {
	if (!bitmap) return { width: fallbackSide, height: fallbackSide }

	return { width: bitmap.w, height: bitmap.h }
}

/**
 * Work out where a surface's controls are, and which buttons they drive.
 *
 * Returns null when the layout describes no controls at all.
 *
 * The schema gives a row and column per control and a bitmap size per style, so positions are derived: each column
 * is as wide as the widest control in it, each row as tall as the tallest. A control smaller than its track sits
 * centred in it. Sizes are a guess with a known error - see `estimateControlSize`.
 */
export function resolveSurfaceView(
	layout: SurfaceSchemaLayoutDefinition,
	placement: SurfaceGridPlacement
): ResolvedSurfaceView | null {
	const entries = Object.entries(layout.controls)
	if (entries.length === 0) return null

	const gridSizeOfSurface = rotatedPanelGridSize(placement.panelGridSize, placement.rotation)
	const quarterTurn = isQuarterTurn(placement.rotation)

	const bitmaps: SurfaceLayoutBitmapSize[] = []
	for (const [, control] of entries) {
		const bitmap = resolveControlStylePreset(layout, control).bitmap
		if (bitmap) bitmaps.push(bitmap)
	}

	// A control with no bitmap still takes up room; the smallest thing the surface draws is the closest to a size
	// for it, failing that a nominal key.
	const fallbackSide =
		bitmaps.length > 0 ? Math.min(...bitmaps.map((bitmap) => Math.min(bitmap.w, bitmap.h))) : NOMINAL_CONTROL_SIZE
	const scale = surfaceRenderScale(bitmaps)

	interface PlacedControl {
		id: string
		cell: SurfaceControlCell
		/** Relative to the surface's own origin, before the offset onto the grid */
		gridX: number
		gridY: number
		size: { width: number; height: number }
		aspectRatio: AspectRatio | null
		renderSize: PreviewRenderSize
	}

	const placed: PlacedControl[] = []
	for (const [id, control] of entries) {
		// The layout is in the panel's own coordinates, which a rotated surface does not share with the grid
		const [gridX, gridY] = unrotateXYForPanel(control.column, control.row, gridSizeOfSurface, placement.rotation)

		const bitmap = resolveControlStylePreset(layout, control).bitmap
		const natural = estimateControlSize(bitmap, fallbackSide)

		placed.push({
			id,
			cell: { row: gridY + placement.offset.rows, column: gridX + placement.offset.columns },
			gridX,
			gridY,
			// A surface on its side presents its controls on their side too
			size: quarterTurn ? { width: natural.height, height: natural.width } : natural,
			aspectRatio: bitmap ? reduceAspectRatio(bitmap.w, bitmap.h) : null,
			renderSize: bitmap
				? clampPreviewRenderSize({ width: bitmap.w * scale, height: bitmap.h * scale })
				: DEFAULT_PREVIEW_RENDER_SIZE,
		})
	}

	// Empty tracks between occupied ones keep their room: controls numbered 0, 3, 5 left space for what's between,
	// and closing it up would draw the device narrower than it is
	const columnWidths = trackSizes(
		placed.map((control) => ({ track: control.gridX, size: control.size.width })),
		fallbackSide
	)
	const rowHeights = trackSizes(
		placed.map((control) => ({ track: control.gridY, size: control.size.height })),
		fallbackSide
	)

	const gap = Math.round(Math.min(...[...columnWidths.values(), ...rowHeights.values()]) * CONTROL_GAP_RATIO)

	const columnOffsets = trackOffsets(columnWidths, gap)
	const rowOffsets = trackOffsets(rowHeights, gap)

	const controls: ResolvedSurfaceControl[] = placed.map((control) => {
		const trackWidth = columnWidths.get(control.gridX) ?? control.size.width
		const trackHeight = rowHeights.get(control.gridY) ?? control.size.height

		return {
			id: control.id,
			cell: control.cell,
			bounds: {
				// Centred in the room the device leaves for it, rather than stretched to fill it
				x: (columnOffsets.get(control.gridX) ?? 0) + (trackWidth - control.size.width) / 2,
				y: (rowOffsets.get(control.gridY) ?? 0) + (trackHeight - control.size.height) / 2,
				width: control.size.width,
				height: control.size.height,
			},
			shape: { type: 'rect', cornerRadiusRatio: CONTROL_CORNER_RATIO },
			aspectRatio: control.aspectRatio,
			renderSize: control.renderSize,
		}
	})

	return {
		controls,
		extent: {
			width: trackExtent(columnWidths, gap),
			height: trackExtent(rowHeights, gap),
		},
		gridBounds: {
			minRow: Math.min(...controls.map((control) => control.cell.row)),
			maxRow: Math.max(...controls.map((control) => control.cell.row)),
			minColumn: Math.min(...controls.map((control) => control.cell.column)),
			maxColumn: Math.max(...controls.map((control) => control.cell.column)),
		},
	}
}

/**
 * How big each track has to be to hold the largest thing in it. Covers every track from first to last, so an empty
 * one still takes up the room the surface left for it.
 */
function trackSizes(entries: readonly { track: number; size: number }[], emptySize: number): Map<number, number> {
	const sizes = new Map<number, number>()

	const tracks = entries.map((entry) => entry.track)
	for (let track = Math.min(...tracks); track <= Math.max(...tracks); track++) {
		sizes.set(track, 0)
	}

	for (const { track, size } of entries) {
		sizes.set(track, Math.max(sizes.get(track) ?? 0, size))
	}

	for (const [track, size] of sizes) {
		if (size === 0) sizes.set(track, emptySize)
	}

	return sizes
}

/** Where each track starts, laid out in order with a gap between them */
function trackOffsets(sizes: ReadonlyMap<number, number>, gap: number): Map<number, number> {
	const offsets = new Map<number, number>()

	let position = 0
	for (const track of [...sizes.keys()].sort((a, b) => a - b)) {
		offsets.set(track, position)
		position += (sizes.get(track) ?? 0) + gap
	}

	return offsets
}

/** How far the tracks reach in total, without a trailing gap */
function trackExtent(sizes: ReadonlyMap<number, number>, gap: number): number {
	let extent = 0
	for (const size of sizes.values()) extent += size + gap

	return Math.max(0, extent - gap)
}
