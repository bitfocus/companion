import { DragDropProvider } from '@dnd-kit/react'
import type { Meta, StoryObj } from '@storybook/react'
import { useEffect, useMemo, useState } from 'react'
import { action } from 'storybook/actions'
import type {
	SurfaceAppearanceDefinition,
	SurfaceSchemaControlDefinition,
	SurfaceSchemaLayoutDefinition,
} from '@companion-app/shared/Model/Surfaces.js'
import { resolveSurfaceView } from '@companion-app/shared/SurfaceLayout.js'
import '../ButtonGridPanel.css'
import { ButtonGridStore } from '../ButtonGridStore.js'
import { ButtonGridViewProvider, type ButtonGridView } from '../ButtonGridViewContext.js'
import type { GridToolActions } from '../GridTools/index.js'
import { SurfaceCanvas } from './SurfaceCanvas.js'

/*
 * Surfaces drawn on their own, to see how a face draws and how it is picked at without a device to hand. There is
 * no server here, so every button shows its placeholder: what is being looked at is where the controls are, what
 * they are drawn as, and what a click or drag lands on - which the Actions panel logs.
 */

// ---- Stream Deck + ----

const streamDeckPlusLayout: SurfaceSchemaLayoutDefinition = {
	stylePresets: {
		default: { bitmap: { w: 120, h: 120 } },
		strip: { bitmap: { w: 200, h: 100 } },
		knob: {},
	},
	controls: Object.fromEntries([
		...[0, 1, 2, 3].flatMap((column) => [
			[`0/${column}`, { row: 0, column }],
			[`1/${column}`, { row: 1, column }],
		]),
		...[0, 1, 2, 3].map((column) => [`2/${column}`, { row: 2, column, stylePreset: 'strip' }]),
		...[0, 1, 2, 3].map((column) => [`3/${column}`, { row: 3, column, stylePreset: 'knob' }]),
	]),
}

const streamDeckPlusAppearance: SurfaceAppearanceDefinition = {
	size: { width: 600, height: 600 },
	bodyColor: '#1c1c1c',
	controls: Object.fromEntries([
		...[0, 1, 2, 3].flatMap((column) => [
			[
				`0/${column}`,
				{ x: 60 + column * 124, y: 40, width: 108, height: 108, shape: { type: 'rect', cornerRadius: 14 } },
			],
			[
				`1/${column}`,
				{ x: 60 + column * 124, y: 164, width: 108, height: 108, shape: { type: 'rect', cornerRadius: 14 } },
			],
		]),
		// One screen, cut into a slice per encoder
		...[0, 1, 2, 3].map((column) => [
			`2/${column}`,
			{ x: 54 + column * 123, y: 300, width: 123, height: 62, type: 'lcd-segment' },
		]),
		...[0, 1, 2, 3].map((column) => [
			`3/${column}`,
			{ x: 72 + column * 123, y: 420, width: 84, height: 84, type: 'encoder' },
		]),
	]),
}

// ---- Contour ShuttlePro v2 ----

/**
 * As the contour-shuttle surface module lays it out. The ring is two controls: `2/2` fires once per movement, and
 * `2/3` repeats for as long as the ring is held over. There is one ring, so the face puts both on it, the repeating
 * one underneath - where it cannot be clicked, which is the problem with a physical control being two of them.
 */
const shuttleProLayout: SurfaceSchemaLayoutDefinition = {
	stylePresets: { default: {} },
	controls: Object.fromEntries(
		[
			// 4 buttons, then 5
			[0, 0],
			[0, 1],
			[0, 2],
			[0, 3],
			[1, 0],
			[1, 1],
			[1, 2],
			[1, 3],
			[1, 4],
			// Either side of the ring, and the jog, shuttle and repeating shuttle
			[2, 0],
			[2, 4],
			[2, 1],
			[2, 2],
			[2, 3],
			// 2 buttons, and 2 more below
			[3, 0],
			[3, 3],
			[3, 1],
			[3, 2],
		].map(([row, column]) => [`${row}/${column}`, { row, column }])
	),
}

/** A rough outline of the device, as artwork for the face: wider at the top, tapering to the base */
const shuttleProBodyImage = `data:image/svg+xml,${encodeURIComponent(
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 480">` +
		`<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3a3c"/><stop offset="1" stop-color="#1f1f21"/></linearGradient></defs>` +
		`<path d="M60 10 H340 Q390 10 392 60 L380 400 Q376 470 300 470 H100 Q24 470 20 400 L8 60 Q10 10 60 10 Z" fill="url(#g)"/>` +
		`</svg>`
)}`

const shuttleProAppearance: SurfaceAppearanceDefinition = {
	size: { width: 400, height: 480 },
	bodyColor: '#2b2b2d',
	bodyImage: shuttleProBodyImage,
	controls: {
		// The top two rows follow the arc of the case
		'0/0': { x: 82, y: 46, width: 50, height: 32, shape: { type: 'rect', cornerRadius: 6 } },
		'0/1': { x: 144, y: 36, width: 50, height: 32, shape: { type: 'rect', cornerRadius: 6 } },
		'0/2': { x: 206, y: 36, width: 50, height: 32, shape: { type: 'rect', cornerRadius: 6 } },
		'0/3': { x: 268, y: 46, width: 50, height: 32, shape: { type: 'rect', cornerRadius: 6 } },
		'1/0': { x: 40, y: 102, width: 50, height: 32, shape: { type: 'rect', cornerRadius: 6 } },
		'1/1': { x: 102, y: 92, width: 50, height: 32, shape: { type: 'rect', cornerRadius: 6 } },
		'1/2': { x: 175, y: 88, width: 50, height: 32, shape: { type: 'rect', cornerRadius: 6 } },
		'1/3': { x: 248, y: 92, width: 50, height: 32, shape: { type: 'rect', cornerRadius: 6 } },
		'1/4': { x: 310, y: 102, width: 50, height: 32, shape: { type: 'rect', cornerRadius: 6 } },
		'2/0': { x: 24, y: 236, width: 40, height: 64, shape: { type: 'rect', cornerRadius: 8 } },
		'2/4': { x: 336, y: 236, width: 40, height: 64, shape: { type: 'rect', cornerRadius: 8 } },
		'3/0': { x: 44, y: 400, width: 80, height: 40, shape: { type: 'rect', cornerRadius: 8 } },
		'3/3': { x: 276, y: 400, width: 80, height: 40, shape: { type: 'rect', cornerRadius: 8 } },
		'3/1': { x: 136, y: 412, width: 60, height: 36, shape: { type: 'rect', cornerRadius: 8 } },
		'3/2': { x: 204, y: 412, width: 60, height: 36, shape: { type: 'rect', cornerRadius: 8 } },
		// The one ring, as both of its controls, then the jog drawn over its middle
		'2/3': { x: 86, y: 154, width: 228, height: 228, type: 'shuttle' },
		'2/2': { x: 86, y: 154, width: 228, height: 228, type: 'shuttle' },
		'2/1': { x: 136, y: 204, width: 128, height: 128, type: 'jog' },
	},
}

// ---- The harness ----

function storyActions(): GridToolActions {
	return {
		openEditor: action('openEditor'),
		press: action('press'),
		transfer: (operation, pairs, onApplied) => {
			action('transfer')(operation, pairs)
			onApplied()
		},
		clearButtons: action('clearButtons'),
		isOccupied: () => true,
		pasteAt: action('pasteAt'),
		fitsOnGrid: () => true,
	}
}

interface SurfaceCanvasDemoProps {
	layout: SurfaceSchemaLayoutDefinition
	/** The face the surface describes */
	appearance: SurfaceAppearanceDefinition
	/** Percent, as the zoom control sets it */
	zoom: number
	/** Clicking a control presses it, rather than selecting it */
	pressMode: boolean
	/** Leave the last column of the surface off the configured grid, to see controls drawn beyond it */
	trimGrid: boolean
}

function SurfaceCanvasDemo({ layout, appearance, zoom, pressMode, trimGrid }: SurfaceCanvasDemoProps) {
	const panelGridSize = useMemo(() => {
		const controls = Object.values<SurfaceSchemaControlDefinition>(layout.controls)
		return {
			rows: Math.max(...controls.map((control) => control.row)) + 1,
			columns: Math.max(...controls.map((control) => control.column)) + 1,
		}
	}, [layout])

	const view = useMemo(
		() => resolveSurfaceView(layout, appearance, { offset: { rows: 0, columns: 0 }, rotation: 0, panelGridSize }),
		[layout, appearance, panelGridSize]
	)

	const gridView = useMemo<ButtonGridView>(
		() => ({ store: new ButtonGridStore(), actions: storyActions(), onContextMenu: action('contextMenu') }),
		[]
	)

	useEffect(() => {
		gridView.store.setTool(pressMode ? 'press' : 'select', gridView.actions)
	}, [gridView, pressMode])

	const [, setViewportMinHeight] = useState(0)

	if (!view) return <p>The layout describes no controls</p>

	const gridSize = {
		...view.gridBounds,
		maxColumn: trimGrid ? view.gridBounds.maxColumn - 1 : view.gridBounds.maxColumn,
	}

	return (
		<DragDropProvider>
			<ButtonGridViewProvider value={gridView}>
				<div className="button-grid-panel-content h-150">
					<SurfaceCanvas
						view={view}
						gridSize={gridSize}
						pageNumber={1}
						drawScale={zoom / 100}
						contextMenuButton={null}
						isHot={pressMode}
						setViewportMinHeight={setViewportMinHeight}
					/>
				</div>
			</ButtonGridViewProvider>
		</DragDropProvider>
	)
}

const meta = {
	component: SurfaceCanvasDemo,
	args: {
		layout: streamDeckPlusLayout,
		appearance: streamDeckPlusAppearance,
		zoom: 100,
		pressMode: false,
		trimGrid: false,
	},
	argTypes: {
		layout: { control: false },
		appearance: { control: false },
		zoom: { control: { type: 'range', min: 25, max: 300, step: 25 } },
	},
} satisfies Meta<typeof SurfaceCanvasDemo>

export default meta
type Story = StoryObj<typeof meta>

/** Keys, a touch screen cut into a slice per encoder, and the encoders under it */
export const StreamDeckPlus: Story = {}

/**
 * A jog wheel inside a shuttle ring, on artwork of the device. Round controls are picked by their circle, so the
 * corners of the jog's box still reach the ring around it.
 */
export const ContourShuttlePro: Story = {
	args: { layout: shuttleProLayout, appearance: shuttleProAppearance },
}

/** A surface whose last column is beyond the configured grid, drawn but locked */
export const BeyondTheGrid: Story = {
	args: { layout: shuttleProLayout, appearance: shuttleProAppearance, trimGrid: true },
}
