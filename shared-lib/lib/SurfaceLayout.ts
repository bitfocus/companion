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
	SurfaceAppearanceDefinition,
	SurfaceLayoutBitmapSize,
	SurfaceRotation,
	SurfaceSchemaControlDefinition,
	SurfaceSchemaControlStylePreset,
	SurfaceSchemaLayoutDefinition,
	SurfaceSchemaLedsConfig,
} from './Model/Surfaces.js'
import type { UserConfigGridSize } from './Model/UserConfigModel.js'
import { estimateFace } from './SurfaceLayoutEstimate.js'

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
 * How a control is drawn: a rounded rectangle, or a circle for a round encoder or jog.
 */
export type SurfaceControlShape =
	| {
			type: 'rect'
			/** As a fraction of the shorter side, so it survives being scaled */
			cornerRadiusRatio: number
	  }
	| { type: 'circle' }

/**
 * What sort of control it is, so it can be drawn as one: a knob rather than a round key, a slice of a shared screen
 * rather than a key of its own. Anything not described as otherwise is a button.
 */
export type SurfaceControlKind = 'button' | 'encoder' | 'jog' | 'shuttle' | 'lcd-segment'

/**
 * What a control shows of its button: a drawn image, only a colour (an rgb-lit key, a touch strip which lights up),
 * or nothing at all (a plain key, a pedal).
 */
export type SurfaceControlFeedback = 'bitmap' | 'color' | 'none'

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
	kind: SurfaceControlKind
	feedback: SurfaceControlFeedback
	/** The leds the control has around or along it, as well as whatever it shows, or null when it has none */
	leds: SurfaceSchemaLedsConfig | null
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
	/**
	 * Every control of the surface, in the order they are drawn, so a later one is on top: as the face lists them when
	 * the surface described one, otherwise as the layout does
	 */
	controls: readonly ResolvedSurfaceControl[]
	/** The whole face, in the same layout units as the control bounds */
	extent: { width: number; height: number }
	/**
	 * The smallest grid rectangle containing every button these controls drive - not the shape of the view, but the
	 * part of the grid it reaches, which the editor's grid-coordinate code needs.
	 */
	gridBounds: UserConfigGridSize
	/** The face's background, when the surface described one, to draw behind the controls; null for the plain ground */
	body: { color: string; image: string | null } | null
}

/** What a control shows, from its style. A bitmap wins over colours, as that is what the panel draws. */
export function controlFeedback(preset: SurfaceSchemaControlStylePreset): SurfaceControlFeedback {
	if (preset.bitmap) return 'bitmap'
	if (preset.colors) return 'color'

	return 'none'
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

/** How round a control's corners are, as a fraction of its shorter side. A Stream Deck key, near enough. */
const CONTROL_CORNER_RATIO = 0.12

/** The size of a control which declares no bitmap, when the surface has nothing else to go on */
const NOMINAL_CONTROL_SIZE = 72

/**
 * Work out where a surface's controls are, and which buttons they drive.
 *
 * Returns null when the layout describes no controls at all.
 *
 * Drawn exactly from the surface's appearance when it described one; otherwise estimated from the layout, see
 * `estimateFace`.
 */
export function resolveSurfaceView(
	layout: SurfaceSchemaLayoutDefinition,
	appearance: SurfaceAppearanceDefinition | null,
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
		/** How big its display is on the face, or null when it has none */
		display: { width: number; height: number } | null
		feedback: SurfaceControlFeedback
		leds: SurfaceSchemaLedsConfig | null
		aspectRatio: AspectRatio | null
		renderSize: PreviewRenderSize
	}

	const placed: PlacedControl[] = []
	for (const [id, control] of entries) {
		// The layout is in the panel's own coordinates, which a rotated surface does not share with the grid
		const [gridX, gridY] = unrotateXYForPanel(control.column, control.row, gridSizeOfSurface, placement.rotation)

		const preset = resolveControlStylePreset(layout, control)
		const bitmap = preset.bitmap
		const display = bitmap ? { width: bitmap.w, height: bitmap.h } : null

		placed.push({
			id,
			cell: { row: gridY + placement.offset.rows, column: gridX + placement.offset.columns },
			gridX,
			gridY,
			// A surface on its side presents its controls on their side too
			display: display && quarterTurn ? { width: display.height, height: display.width } : display,
			feedback: controlFeedback(preset),
			leds: preset.leds ?? null,
			aspectRatio: bitmap ? reduceAspectRatio(bitmap.w, bitmap.h) : null,
			renderSize: bitmap
				? clampPreviewRenderSize({ width: bitmap.w * scale, height: bitmap.h * scale })
				: DEFAULT_PREVIEW_RENDER_SIZE,
		})
	}

	// A surface which described its own face is drawn from that, exactly, rather than the estimate below. Only
	// while mounted the normal way up: rotating a described face is not done yet, so a rotated surface falls
	// back to the derived layout, which does handle rotation.
	if (appearance && isUnrotated(placement.rotation) && placed.every((control) => appearance.controls[control.id])) {
		// Stacked as the face lists them, not as the layout does: a later one is drawn, and hit, on top - a jog wheel
		// inside its shuttle ring
		const faceOrder = Object.keys(appearance.controls)
		const stacked = placed.toSorted((a, b) => faceOrder.indexOf(a.id) - faceOrder.indexOf(b.id))

		const controls: ResolvedSurfaceControl[] = stacked.map((control) => {
			const face = appearance.controls[control.id]
			const kind = controlKind(face.type)
			return {
				id: control.id,
				cell: control.cell,
				bounds: { x: face.x, y: face.y, width: face.width, height: face.height },
				shape: shapeFromAppearance(face, kind),
				kind,
				feedback: control.feedback,
				leds: control.leds,
				aspectRatio: control.aspectRatio,
				renderSize: control.renderSize,
			}
		})

		return {
			controls,
			extent: { width: appearance.size.width, height: appearance.size.height },
			gridBounds: gridBoundsFromCells(controls),
			body: { color: appearance.bodyColor, image: appearance.bodyImage ?? null },
		}
	}

	const face = estimateFace(
		placed.map((control) => ({
			track: { x: control.gridX, y: control.gridY },
			display: control.display,
			ring: control.leds?.mode === 'full-ring',
		})),
		fallbackSide
	)

	const controls: ResolvedSurfaceControl[] = placed.map((control, index) => ({
		id: control.id,
		cell: control.cell,
		bounds: face.bounds[index],
		shape: { type: 'rect', cornerRadiusRatio: CONTROL_CORNER_RATIO },
		// The layout alone does not say what a control is, so an estimated face is all keys
		kind: 'button',
		feedback: control.feedback,
		leds: control.leds,
		aspectRatio: control.aspectRatio,
		renderSize: control.renderSize,
	}))

	return {
		controls,
		extent: face.extent,
		gridBounds: gridBoundsFromCells(controls),
		// No described face; the plain ground shows between the controls
		body: null,
	}
}

/** The plain-up orientations, where a described face can be drawn as-is without turning it */
function isUnrotated(rotation: SurfaceRotation): boolean {
	return rotation === 0 || rotation === 'surface0'
}

/**
 * What kind of control the face says this is. Taken as a plain string, so a kind newer than this knows of is drawn as
 * a button rather than refused.
 */
export function controlKind(type: string | undefined): SurfaceControlKind {
	switch (type) {
		case 'encoder':
		case 'jog':
		case 'shuttle':
		case 'lcd-segment':
			return type
		default:
			return 'button'
	}
}

/** The kinds which turn, so are round unless the face says otherwise, and can be turned from the editor */
export function isRotaryKind(kind: SurfaceControlKind): boolean {
	return kind === 'encoder' || kind === 'jog' || kind === 'shuttle'
}

/** A described face is drawn as described: a rect is only rounded when the surface gives it a radius */
function shapeFromAppearance(
	face: SurfaceAppearanceDefinition['controls'][string],
	kind: SurfaceControlKind
): SurfaceControlShape {
	// A knob is round whatever the face says; a jog or shuttle unless the face says otherwise
	if (kind === 'encoder' || face.shape?.type === 'circle' || (!face.shape && isRotaryKind(kind))) {
		return { type: 'circle' }
	}

	const cornerRadius = face.shape?.type === 'rect' ? (face.shape.cornerRadius ?? 0) : 0
	const minSide = Math.min(face.width, face.height)

	return { type: 'rect', cornerRadiusRatio: minSide > 0 ? cornerRadius / minSide : 0 }
}

function gridBoundsFromCells(controls: readonly ResolvedSurfaceControl[]): UserConfigGridSize {
	return {
		minRow: Math.min(...controls.map((control) => control.cell.row)),
		maxRow: Math.max(...controls.map((control) => control.cell.row)),
		minColumn: Math.min(...controls.map((control) => control.cell.column)),
		maxColumn: Math.max(...controls.map((control) => control.cell.column)),
	}
}
