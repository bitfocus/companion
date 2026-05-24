/* eslint-disable react-refresh/only-export-components */
import { Popover as BasePopover } from '@base-ui/react/popover'
import classNames from 'classnames'
import type { ButtonColor } from './Button'

// ─── Root ─────────────────────────────────────────────────────────────────────

type PopoverRootProps = BasePopover.Root.Props

function PopoverRoot(props: PopoverRootProps): JSX.Element {
	return <BasePopover.Root {...props} />
}

// ─── Trigger ──────────────────────────────────────────────────────────────────

export interface PopoverTriggerProps extends Omit<BasePopover.Trigger.Props, 'className'> {
	className?: string
	color?: ButtonColor | null
	size?: 'sm' | 'lg'
	caret?: boolean
}

function PopoverTrigger({ className, color, size, caret, ...props }: PopoverTriggerProps): JSX.Element {
	return (
		<BasePopover.Trigger
			className={classNames(
				'button',
				'btn',
				color !== null && `button-${color || 'secondary'}`,
				size && `button-${size}`,
				caret && 'popover2-trigger-caret',
				className
			)}
			{...props}
		/>
	)
}

// ─── Popup ────────────────────────────────────────────────────────────────────

export interface PopoverPopupProps {
	className?: string
	positionerClassName?: string
	children?: React.ReactNode
	sideOffset?: number
	side?: BasePopover.Positioner.Props['side']
	align?: BasePopover.Positioner.Props['align']
	anchor?: BasePopover.Positioner.Props['anchor']
	arrow?: boolean
}

function PopoverPopup({
	className,
	positionerClassName,
	children,
	arrow,
	sideOffset = arrow ? 10 : 4,
	side = 'bottom',
	align = 'start',
	anchor,
}: PopoverPopupProps): JSX.Element {
	return (
		<BasePopover.Portal>
			<BasePopover.Positioner
				className={classNames('popover2-positioner', positionerClassName)}
				sideOffset={sideOffset}
				side={side}
				align={align}
				anchor={anchor}
			>
				<BasePopover.Popup className={classNames('popover2-popup', className)}>
					{arrow && <BasePopover.Arrow className="popover2-arrow" />}
					{children}
				</BasePopover.Popup>
			</BasePopover.Positioner>
		</BasePopover.Portal>
	)
}

// ─── Item ─────────────────────────────────────────────────────────────────────

export interface PopoverItemProps extends Omit<BasePopover.Close.Props, 'className'> {
	className?: string
}

function PopoverItem({ className, ...props }: PopoverItemProps): JSX.Element {
	return <BasePopover.Close className={classNames('popover2-item', className)} {...props} />
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const Popover = {
	Root: PopoverRoot,
	Trigger: PopoverTrigger,
	Popup: PopoverPopup,
	Item: PopoverItem,
}
