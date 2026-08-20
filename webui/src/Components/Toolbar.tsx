/* eslint-disable react-refresh/only-export-components */
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import './Toolbar.css'
import { Tooltip } from './Tooltip.js'

interface ToolbarRootProps {
	/** Vertical reads as a rail beside what it acts on; horizontal as a strip above it */
	orientation: 'horizontal' | 'vertical'
	/** 'sm' is icon-only and compact, for sitting alongside a canvas */
	size?: 'sm'
	className?: string
	children: React.ReactNode
}

function ToolbarRoot({ orientation, size, className, children }: ToolbarRootProps): React.JSX.Element {
	return (
		<div
			role="toolbar"
			aria-orientation={orientation}
			className={classNames('toolbar', `toolbar-${orientation}`, size && `toolbar-${size}`, className)}
		>
			{children}
		</div>
	)
}

interface ToolbarButtonProps {
	icon: Parameters<typeof FontAwesomeIcon>[0]['icon']
	title: string
	onClick: () => void
	/** Highlighted, either because it is the current mode or because a toggle is on */
	active?: boolean
	/** Mirrors `active` to assistive tech, for buttons that really are toggles */
	pressed?: boolean
	/** Names the button when its label is not rendered */
	ariaLabel?: string
	/** Marks a button whose action is live or irreversible */
	tone?: 'danger'
	disabled?: boolean
	/** Explains the disabling, in a tooltip. A disabled button emits no hover events of its own. */
	disabledReason?: string | null
}

function ToolbarButton({
	icon,
	title,
	onClick,
	active,
	pressed,
	ariaLabel,
	tone,
	disabled,
	disabledReason,
}: ToolbarButtonProps): React.JSX.Element {
	const button = (
		<button
			type="button"
			title={disabledReason ? undefined : title}
			aria-label={ariaLabel}
			aria-pressed={pressed}
			className={classNames('toolbar-button', { active, [`toolbar-button-${tone}`]: tone })}
			onClick={onClick}
			disabled={disabled}
		>
			<FontAwesomeIcon icon={icon} />
		</button>
	)

	if (!disabledReason) return button

	return (
		<Tooltip.Root>
			<Tooltip.Trigger render={<span className="toolbar-button-tooltip">{button}</span>} delay={300} />
			<Tooltip.Popup side="right" arrow size="md">
				{disabledReason}
			</Tooltip.Popup>
		</Tooltip.Root>
	)
}

function ToolbarSeparator(): React.JSX.Element {
	return <div className="toolbar-separator" />
}

/**
 * Keeps a set of buttons together. Only matters in a toolbar narrow enough to wrap, where without
 * this the break falls between arbitrary buttons rather than between groups.
 */
function ToolbarGroup({ children }: { children: React.ReactNode }): React.JSX.Element {
	return <div className="toolbar-group">{children}</div>
}

interface ToolbarStatusProps {
	/** Rendered dimmed, for when the toolbar is only saying what mode it is in */
	muted?: boolean
	/** Marks a state that is live or irreversible, so the toolbar itself carries the warning */
	tone?: 'danger'
	children: React.ReactNode
}

/**
 * What the toolbar has to say, filling the space left over by the buttons.
 *
 * It is always present, even when there is nothing to report, so the toolbar keeps one height and
 * the content below it never moves.
 */
function ToolbarStatus({ muted, tone, children }: ToolbarStatusProps): React.JSX.Element {
	return (
		<div
			className={classNames('toolbar-status', { 'toolbar-status-muted': muted, [`toolbar-status-${tone}`]: tone })}
			role="status"
		>
			{children}
		</div>
	)
}

export const Toolbar = {
	Root: ToolbarRoot,
	Button: ToolbarButton,
	Separator: ToolbarSeparator,
	Group: ToolbarGroup,
	Status: ToolbarStatus,
}
