import classNames from 'classnames'
import './Badge.css'
import { forwardRef, type HTMLAttributes } from 'react'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
	/**
	 * A string of all className you want applied to the component.
	 */
	className?: string
	/**
	 * Sets the colour context of the component to one of the themed colours.
	 */
	color: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'dark' | 'light'
	/**
	 * Set the badge variant. `solid` is a filled pill, `tonal` a tinted pill with matching text.
	 */
	variant?: 'solid' | 'tonal'
}

/**
 * A small pill labelling the thing it sits beside - a status, a flag, a count.
 * Keep the label to a word or two; anything longer belongs in an `Alert` or a tooltip.
 */
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
	({ children, className, color, variant = 'solid', ...rest }, ref) => {
		return (
			<span
				className={classNames('badge-element', `badge-${color}`, { 'badge-tonal': variant === 'tonal' }, className)}
				{...rest}
				ref={ref}
			>
				{children}
			</span>
		)
	}
)
