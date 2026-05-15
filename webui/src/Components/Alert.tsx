import { CCloseButton, useForkedRef } from '@coreui/react'
import classNames from 'classnames'
import { forwardRef, useEffect, useRef, useState, type HTMLAttributes } from 'react'
import { Transition } from 'react-transition-group'

export interface StaticAlertProps extends HTMLAttributes<HTMLDivElement> {
	/**
	 * A string of all className you want applied to the component.
	 */
	className?: string
	/**
	 * Sets the color context of the component to one of CoreUI’s themed colors.
	 */
	color: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'dark' | 'light' | string
	/**
	 * Set the alert variant to a solid.
	 */
	variant?: 'solid' | 'alert'
}

export interface DismissableAlertProps extends StaticAlertProps {
	/**
	 * Callback fired when the component requests to be closed.
	 */
	onClose?: () => void
	/**
	 * Toggle the visibility of component.
	 */
	visible?: boolean
}

export const StaticAlert = forwardRef<HTMLDivElement, StaticAlertProps>(
	({ children, className, color = 'primary', variant, ...rest }, ref) => {
		return (
			<div
				className={classNames(
					'alert-element',
					variant === 'solid' ? `bg-${color} text-white` : `alert-${color}`,
					className
				)}
				role="alert"
				{...rest}
				ref={ref}
			>
				{children}
			</div>
		)
	}
)

export const DismissableAlert = forwardRef<HTMLDivElement, DismissableAlertProps>(
	({ children, onClose, className, visible = true, ...rest }, ref) => {
		const alertRef = useRef<HTMLDivElement>(null)
		const forkedRef = useForkedRef(ref, alertRef)
		const [_visible, setVisible] = useState(visible)

		useEffect(() => setVisible(visible), [visible])

		return (
			<Transition in={_visible} mountOnEnter nodeRef={alertRef} onExit={onClose} timeout={150} unmountOnExit>
				{(state) => (
					<StaticAlert
						{...rest}
						ref={forkedRef}
						className={classNames(className, {
							'alert-dismissible fade': true,
							show: state === 'entered',
						})}
					>
						{children}
						<CCloseButton onClick={() => setVisible(false)} />
					</StaticAlert>
				)}
			</Transition>
		)
	}
)
