/* eslint-disable react-refresh/only-export-components */
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'
import classNames from 'classnames'

// ─── Root ─────────────────────────────────────────────────────────────────────

type TooltipRootProps = BaseTooltip.Root.Props

function TooltipRoot(props: TooltipRootProps): JSX.Element {
	return <BaseTooltip.Root {...props} />
}

// ─── Trigger ──────────────────────────────────────────────────────────────────

type TooltipTriggerProps = BaseTooltip.Trigger.Props

function TooltipTrigger(props: TooltipTriggerProps): JSX.Element {
	return <BaseTooltip.Trigger {...props} />
}

// ─── Popup ────────────────────────────────────────────────────────────────────

export interface TooltipPopupProps {
	children?: React.ReactNode
	className?: string
	positionerClassName?: string
	side?: BaseTooltip.Positioner.Props['side']
	sideOffset?: number
	align?: BaseTooltip.Positioner.Props['align']
	arrow?: boolean
	size?: 'md' | 'lg'
	noPadding?: boolean
}

function TooltipPopup({
	children,
	className,
	positionerClassName,
	side = 'top',
	sideOffset,
	align,
	arrow = false,
	size,
	noPadding = false,
}: TooltipPopupProps): JSX.Element {
	const resolvedSideOffset = sideOffset ?? (arrow ? 10 : 4)
	return (
		<BaseTooltip.Portal>
			<BaseTooltip.Positioner
				side={side}
				sideOffset={resolvedSideOffset}
				align={align}
				className={classNames('tooltip2-positioner', positionerClassName)}
			>
				<BaseTooltip.Popup
					role="tooltip"
					className={classNames(
						'tooltip2-popup',
						size && `tooltip2-popup--${size}`,
						noPadding && 'tooltip2-popup--no-padding',
						className
					)}
				>
					{arrow && <BaseTooltip.Arrow className="tooltip2-arrow" />}
					{children}
				</BaseTooltip.Popup>
			</BaseTooltip.Positioner>
		</BaseTooltip.Portal>
	)
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const Tooltip = {
	Root: TooltipRoot,
	Trigger: TooltipTrigger,
	Popup: TooltipPopup,
}
