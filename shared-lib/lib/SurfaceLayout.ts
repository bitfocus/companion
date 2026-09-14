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
 * Layout units measure the face, not the bitmaps drawn on it. They are deliberately not pixels: two controls of
 * the same physical size can be drawn at wildly different resolutions - a Stream Deck + draws its touch strip at a
 * higher density than its keys - so a pixel count says how much detail a control has, never how big it is.
 * How many pixels to draw a control with is `renderSize`, and the two are kept apart on purpose.
 *
 * Nor are they cells: a surface is a physical object whose controls are wherever they are, and the only reason its
 * controls currently line up is that the schema has no way to say otherwise yet.
 *
 * The unit itself has no fixed meaning; only the ratios between controls on one surface matter, because that is
 * all that is needed to draw the face. See `estimateControlSize` for where today's numbers come from, and what is
 * wrong with them.
 */
export interface SurfaceRect {
	x: number
	y: number
	width: number
	height: number
}

/**
 * How a control is drawn.
 *
 * Rectangles are all the schema can describe today. A round encoder, a curved strip or anything else arrives as
 * another member of this union, which is why it is a union with one member rather than a bare corner radius.
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
	/**
	 * The shape of the bitmap this control is drawn with, or null when its style declares no bitmap at all - an
	 * encoder which only has leds, or a text-only display.
	 */
	aspectRatio: AspectRatio | null
	/**
	 * How many pixels to draw a preview of this control with - its resolution, which is a different question to
	 * how large it is on the face. A small dense display and a large coarse one can want the same `bounds` and
	 * very different numbers here.
	 */
	renderSize: PreviewRenderSize
}

/**
 * A surface's layout, resolved into something that can be drawn.
 *
 * Deliberately a flat list of placed controls rather than anything shaped like a grid. What the schema can say
 * today is only rows and columns, but what this describes is a face with controls on it, so the drawing, the
 * hit-testing and the navigation above this never learn that the positions came from a lattice. When the schema
 * can carry real positions, only `resolveSurfaceView` changes.
 */
export interface ResolvedSurfaceView {
	/** Every control of the surface, in the order the layout listed them */
	controls: readonly ResolvedSurfaceControl[]
	/** The whole face, in the same layout units as the control bounds */
	extent: { width: number; height: number }
	/**
	 * The smallest rectangle of the grid containing every button these controls drive.
	 *
	 * Not the shape of the view - the view is whatever shape the surface is - but the part of the grid it reaches,
	 * which is what the parts of the editor that work in grid coordinates need.
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
 * A layout knows nothing about the size of the panel it describes, so this is what stands in when the surface
 * itself is not there to say - viewing as a type of surface rather than as one which is plugged in.
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

/** The gap left between controls, as a fraction of the smallest control. Stands in for the bezel of a real device. */
const CONTROL_GAP_RATIO = 0.14

/** How round a control's corners are, as a fraction of its shorter side. A Stream Deck key, near enough. */
const CONTROL_CORNER_RATIO = 0.12

/** The size of a control which declares no bitmap, when the surface has nothing else to go on */
const NOMINAL_CONTROL_SIZE = 72

/**
 * How big a control is on the face, in layout units.
 *
 * This is the one guess in here, and it is worth naming as one. The schema says how many pixels a control is drawn
 * with and nothing about how large it is, so this treats a pixel as a fixed amount of face - which is to say it
 * assumes every control on a surface has the same pixel density.
 *
 * Real devices do not. A Stream Deck + key is 120x120 across about 20mm, and a segment of its touch strip is
 * 200x100 across about 25x12mm: the strip is drawn at appreciably more pixels per mm than the keys, so taking the
 * bitmap at face value makes it come out wider and taller, relative to a key, than it really is. The shapes are
 * right and the ordering is right - a strip segment is wider than it is tall, and wider than a key - but the
 * proportions are only as good as that assumption.
 *
 * It is the best available until a layout can state a physical size (or a density) per control, separately from
 * the resolution it is drawn at. When it can, this function reads it and nothing else here changes.
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
 * Returns null when the layout describes no controls at all, which is not a surface anything can be viewed as.
 *
 * The schema gives a row and a column per control and a bitmap size per style, so the positions have to be
 * derived: each column is as wide as the widest control in it and each row as tall as the tallest, which is what
 * gives a Stream Deck + a row of short, wide strip segments under its keys rather than a uniform lattice with the
 * strip squeezed into it. A control smaller than the track it is in sits in the middle of it, the way a small
 * control sits in the space a device leaves for it.
 *
 * How big each control is taken to be is a guess with a known error in it - see `estimateControlSize`.
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

	// A control with no bitmap of its own still takes up room on the device. The smallest thing the surface does
	// draw is the closest thing to a size for it; failing that, a nominal key.
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

	// Empty tracks between occupied ones keep their room: a surface which numbers its controls 0, 3 and 5 has
	// left space for whatever is in between, and closing it up would draw a device narrower than it is
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
 * How big each track has to be to hold the largest thing in it.
 *
 * Covers every track from the first to the last, so that one with nothing in it still takes up the room the
 * surface left for it rather than being closed up.
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
