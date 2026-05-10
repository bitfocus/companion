import type { Meta, StoryObj } from '@storybook/react'
import { useArgs } from 'storybook/preview-api'
import { ButtonGridZoomControl } from './ButtonGridZoomControl'
import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP, type GridZoomController } from './GridZoom'

function makeController(setZoom: (v: number) => void, zoom: number): GridZoomController {
	return {
		zoomIn: () => setZoom(Math.min(zoom + ZOOM_STEP, ZOOM_MAX)),
		zoomOut: () => setZoom(Math.max(zoom - ZOOM_STEP, ZOOM_MIN)),
		zoomReset: () => setZoom(100),
		setZoom,
	}
}

const meta = {
	component: ButtonGridZoomControl,
	args: {
		useCompactButtons: false,
		gridZoomValue: 100,
	},
	render: function Render(args) {
		const [, setArgs] = useArgs<{ gridZoomValue: number }>()
		const controller = makeController((v) => setArgs({ gridZoomValue: v }), args.gridZoomValue)
		return <ButtonGridZoomControl {...args} gridZoomController={controller} />
	},
	argTypes: {
		useCompactButtons: { control: 'boolean' },
		gridZoomValue: { control: { type: 'range', min: ZOOM_MIN, max: ZOOM_MAX, step: ZOOM_STEP } },
	},
} satisfies Meta<typeof ButtonGridZoomControl>

export default meta
type Story = StoryObj<typeof meta>

/** Full-size button showing the zoom percentage label */
export const Default: Story = {
	args: {
		gridZoomController: makeController(() => {}, 100),
	},
}

/** Compact button — icon only, no percentage label */
export const Compact: Story = {
	args: { useCompactButtons: true, gridZoomController: makeController(() => {}, 100) },
}

/** Zoomed in to 150% */
export const ZoomedIn: Story = {
	args: { gridZoomValue: 150, gridZoomController: makeController(() => {}, 150) },
}

/** Zoomed out to 50% */
export const ZoomedOut: Story = {
	args: { gridZoomValue: 50, gridZoomController: makeController(() => {}, 50) },
}
