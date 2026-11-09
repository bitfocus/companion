import type { Meta, StoryObj } from '@storybook/react'
import { useSplitResize, type SplitOrientation } from '~/Hooks/useSplitResize.js'
import { ResizeHandle } from './ResizeHandle'

function DemoSplit({ orientation }: { orientation: SplitOrientation }) {
	const { rootRef, rootStyle, handleProps } = useSplitResize({
		orientation,
		enabled: true,
		storageKey: `storybook-resize-handle:${orientation}`,
		panelSelectors: ['.demo-first', '.demo-second'],
		minFirstPx: 100,
		minSecondPx: 100,
		defaultFirstPercent: 40,
	})

	return (
		<div
			ref={rootRef}
			className={orientation === 'horizontal' ? 'relative grid h-80 gap-x-6' : 'relative grid h-80 gap-y-4'}
			style={rootStyle}
		>
			<div className="demo-first bg-surface-alt p-2">First</div>
			<div className="demo-second bg-surface-alt p-2">Second</div>
			<ResizeHandle {...handleProps} />
		</div>
	)
}

const meta = {
	component: ResizeHandle,
	decorators: [
		(Story) => (
			<div style={{ padding: 24, background: 'var(--color-surface)' }}>
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof ResizeHandle>

export default meta
type Story = StoryObj<typeof meta>

const noop = () => {}
const BASE_ARGS = {
	ref: null,
	valuePercent: 40,
	valueMin: 20,
	valueMax: 80,
	dragging: false,
	onPointerDown: noop,
	onDoubleClick: noop,
	onKeyDown: noop,
} as const

export const Horizontal: Story = {
	args: { ...BASE_ARGS, orientation: 'horizontal' },
	render: () => <DemoSplit orientation="horizontal" />,
}

export const Vertical: Story = {
	args: { ...BASE_ARGS, orientation: 'vertical' },
	render: () => <DemoSplit orientation="vertical" />,
}
