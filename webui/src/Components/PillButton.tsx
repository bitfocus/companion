import classNames from 'classnames'
import './PillButton.css'

export type PillTone = 'good' | 'warning' | 'error' | 'info' | 'neutral' | 'accent' | 'media' | 'routing' | 'primary'

interface PillButtonProps {
	/** Colour the pill takes when active. Inactive pills all look the same. */
	tone: PillTone
	active: boolean
	onClick: () => void
	title?: string
	/** Tighter padding, for a dense row of filters. */
	small?: boolean
	className?: string
	children: React.ReactNode
}

export function PillButton({
	tone,
	active,
	onClick,
	title,
	small,
	className,
	children,
}: PillButtonProps): React.JSX.Element {
	return (
		<button
			type="button"
			onClick={onClick}
			title={title}
			aria-pressed={active}
			className={classNames(
				'pill-button',
				`pill-tone-${tone}`,
				active && 'pill-button-active',
				small && 'pill-button-sm',
				className
			)}
		>
			{children}
		</button>
	)
}

/** A strip of `PillButton`s sharing one well, as a segmented control. */
export function PillButtonGroup({
	className,
	children,
}: {
	className?: string
	children: React.ReactNode
}): React.JSX.Element {
	return <div className={classNames('pill-button-group', className)}>{children}</div>
}
