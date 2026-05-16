import { CButton } from '@coreui/react'
import { Link, type RegisteredRouter, type ToPathOption } from '@tanstack/react-router'
import classNames from 'classnames'
import * as React from 'react'

export type ButtonColor =
	| 'primary'
	| 'secondary'
	| 'success'
	| 'danger'
	| 'warning'
	| 'info'
	| 'light'
	| 'dark'
	| 'gray'
	| 'white'
	| 'disabled'
	| 'link'

interface ButtonVisualProps {
	className?: string
	color?: ButtonColor
	/** 'ghost' renders a text-only button with no background or border */
	variant?: 'ghost' | 'outline'
	size?: 'sm' | 'lg'
	hidden?: boolean

	disabled?: boolean
}

// function getColorClasses(props: ButtonVisualProps): string {
// 	return classNames(
// 		'btn',
// 		{
// 			[`btn-${props.variant}-${props.color}`]: props.variant && props.color,
// 			[`btn-${props.variant}`]: props.variant && !props.color,
// 			[`btn-${props.color}`]: !props.variant && props.color,
// 			[`btn-${props.size}`]: props.size,
// 		},
// 		// props.shape,
// 		props.className
// 	)
// }

export interface ButtonProps extends React.PropsWithChildren<ButtonVisualProps> {
	title?: string
	type?: 'submit' | 'reset'
	autoFocus?: boolean
	tabIndex?: number

	onClick?: React.MouseEventHandler<HTMLElement>
	onMouseDown?: React.MouseEventHandler<HTMLElement>
	onMouseUp?: React.MouseEventHandler<HTMLElement>
}

// TODO - rebuild this!
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(props, ref) {
	// return (
	// 	<CLink
	// 		// as={rest.href ? 'a' : as}
	// 		// {...(!rest.href && { type: type })}
	// 		className={getColorClasses(props)}
	// 		// {...rest}
	// 		ref={ref}
	// 	>
	// 		{props.children}
	// 	</CLink>
	// )
	return <CButton {...props} ref={ref} />
})

interface LinkButtonBaseProps extends React.PropsWithChildren<ButtonVisualProps> {
	onClick?: React.MouseEventHandler
	title?: string
}

export interface LinkButtonProps<
	TFrom extends string = string,
	TTo extends string | undefined = undefined,
> extends LinkButtonBaseProps {
	to: ToPathOption<RegisteredRouter, TFrom, TTo>
}

// TODO - rebuild this!
export function LinkButton<const TFrom extends string = string, const TTo extends string | undefined = undefined>({
	to,
	...rest
}: LinkButtonProps<TFrom, TTo>): React.JSX.Element {
	return <CButton as={Link} to={to} {...rest} />
}

export interface LinkButtonExternalProps extends LinkButtonBaseProps {
	href: string
	target?: string
	rel?: string
}

// TODO - rebuild this!
export function LinkButtonExternal({ href, ...rest }: LinkButtonExternalProps): React.JSX.Element {
	return (
		<CButton as="a" href={href} {...rest} target={rest.target ?? '_blank'} rel={rest.rel ?? 'noopener noreferrer'} />
	)
}

export interface ButtonGroupProps {
	/**
	 * A string of all className you want applied to the base component.
	 */
	className?: string
	/**
	 * Create a set of buttons that appear vertically stacked rather than horizontally. Split button dropdowns are not supported here.
	 */
	vertical?: boolean
}

export function ButtonGroup({
	className,
	vertical,
	children,
}: React.PropsWithChildren<ButtonGroupProps>): React.JSX.Element {
	return (
		<div
			className={classNames(vertical ? 'button-group-vertical' : 'button-group', className)}
			role="group"
			// ref={ref}
		>
			{children}
		</div>
	)
}
