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
	color?: ButtonColor
	/** 'ghost' renders a text-only button with no background or border */
	variant?: 'ghost' | 'outline'
	size?: 'sm' | 'lg'
	hidden?: boolean
}

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'color'>, ButtonVisualProps {}

// TODO - rebuild this!
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(props, ref) {
	return <CButton {...props} ref={ref} />
})

interface LinkButtonBaseProps extends ButtonVisualProps {
	children?: React.ReactNode
	className?: string
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
