import type { Meta, StoryObj } from '@storybook/react'
import type { SurfaceSchemaLayoutDefinition } from '@companion-app/shared/Model/Surfaces.js'
import { resolveSurfaceGridView } from '@companion-app/shared/SurfaceLayout.js'
import type { GridViewAsResolution } from './GridViewAs'
import { GridViewAsBanner } from './GridViewAsBanner'

/** Shaped like a Stream Deck +: square buttons over a 2:1 touch strip */
const plusLayout: SurfaceSchemaLayoutDefinition = {
	stylePresets: {
		default: { bitmap: { w: 120, h: 120 } },
		strip: { bitmap: { w: 200, h: 100 } },
	},
	controls: Object.fromEntries([
		...[0, 1, 2, 3].flatMap((column) => [
			[`0/${column}`, { row: 0, column }],
			[`1/${column}`, { row: 1, column }],
		]),
		...[0, 1, 2, 3].map((column) => [`2/${column}`, { row: 2, column, stylePreset: 'strip' }]),
	]),
}

function readyResolution(overrides: Partial<Extract<GridViewAsResolution, { status: 'ready' }>> = {}) {
	const view = resolveSurfaceGridView(plusLayout, {
		offset: { rows: 0, columns: 0 },
		rotation: 0,
		panelGridSize: { rows: 3, columns: 4 },
	})!

	return {
		status: 'ready' as const,
		displayName: 'Stream Deck + (desk)',
		view,
		bounds: view.bounds,
		partlyOffGrid: false,
		...overrides,
	}
}

const meta = {
	component: GridViewAsBanner,
	args: { onExit: () => {} },
} satisfies Meta<typeof GridViewAsBanner>

export default meta
type Story = StoryObj<typeof meta>

/** Viewing as a surface whose controls are all the same shape */
export const Viewing: Story = {
	args: {
		resolution: readyResolution({
			view: { ...readyResolution().view, hasMixedAspectRatios: false },
			displayName: 'Stream Deck XL (desk)',
		}),
	},
}

/** A Stream Deck +, where the touch strip is a different shape to the buttons */
export const MixedShapes: Story = {
	args: { resolution: readyResolution() },
}

/** Part of the surface hangs off the grid, so part of it is not being shown */
export const PartlyOffGrid: Story = {
	args: { resolution: readyResolution({ partlyOffGrid: true }) },
}

/** The view was turned on before anything was chosen for it to show */
export const NothingChosen: Story = {
	args: { resolution: { status: 'noSelection' } },
}

/** The surface was forgotten while it was being viewed as */
export const SurfaceGone: Story = {
	args: { resolution: { status: 'unknownSurface' } },
}

/** Nothing has ever told Companion how this surface is laid out */
export const NoLayout: Story = {
	args: { resolution: { status: 'noLayout', displayName: 'Old Deck (xyz)' } },
}

/** The offsets have pushed the surface entirely beyond the grid */
export const OffGrid: Story = {
	args: { resolution: { status: 'offGrid', displayName: 'Stream Deck XL' } },
}
