import classNames from 'classnames'
import { forwardRef, type HTMLAttributes } from 'react'

export interface CalloutProps extends HTMLAttributes<HTMLDivElement> {
	/**
	 * A string of all className you want applied to the component.
	 */
	className?: string
	/**
	 * Sets the color context of the component to one of CoreUI’s themed colors.
	 */
	color: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'dark' | 'light' | string
}

export const Callout = forwardRef<HTMLDivElement, CalloutProps>(
	({ children, className, color = 'primary', ...rest }, ref) => {
		return (
			<div className={classNames('callout2-element', `callout2-${color}`, className)} role="alert" {...rest} ref={ref}>
				{children}
			</div>
		)
	}
)
