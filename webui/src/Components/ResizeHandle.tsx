import './ResizeHandle.css'
import classNames from 'classnames'
import type { SplitOrientation } from '~/Hooks/useSplitResize.js'

export interface ResizeHandleProps {
	ref: React.Ref<HTMLDivElement>
	/** The layout of the split it divides: `horizontal` panels side by side, `vertical` stacked. */
	orientation: SplitOrientation
	/** The first panel's share of the split, in percent. */
	valuePercent: number
	valueMin: number
	valueMax: number
	dragging: boolean
	onPointerDown: React.PointerEventHandler<HTMLDivElement>
	onDoubleClick: React.MouseEventHandler<HTMLDivElement>
	onKeyDown: React.KeyboardEventHandler<HTMLDivElement>
}

/**
 * The draggable divide between two panels: a rule the length of the split with a grip over its centre.
 * Absolutely positioned within the split's root, along the gap between the panels (see `useSplitResize`).
 */
export function ResizeHandle({
	ref,
	orientation,
	valuePercent,
	valueMin,
	valueMax,
	dragging,
	onPointerDown,
	onDoubleClick,
	onKeyDown,
}: ResizeHandleProps): React.JSX.Element {
	return (
		<div
			ref={ref}
			className={classNames('resize-handle', orientation)}
			data-dragging={dragging || undefined}
			onPointerDown={onPointerDown}
			onDoubleClick={onDoubleClick}
			onKeyDown={onKeyDown}
			role="separator"
			tabIndex={0}
			// The orientation of the rule itself, which runs across the split
			aria-orientation={orientation === 'horizontal' ? 'vertical' : 'horizontal'}
			aria-label="Resize panel split"
			title="Drag to resize · Double-click to reset"
			aria-valuenow={Math.round(valuePercent)}
			aria-valuemin={valueMin}
			aria-valuemax={valueMax}
		/>
	)
}
