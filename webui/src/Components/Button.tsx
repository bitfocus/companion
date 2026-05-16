import { Button as ButtonBase } from '@base-ui/react'
import { Link, type RegisteredRouter, type ToPathOption } from '@tanstack/react-router'
import classNames from 'classnames'
import * as React from 'react'
import type { Complete } from '@companion-module/base'

export type ButtonColor =
	| 'primary'
	| 'secondary'
	| 'success'
	| 'danger'
	| 'warning'
	| 'info'
	| 'light'
	| 'dark'
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
	active?: boolean
}

function getColorClasses(props: ButtonVisualProps): string {
	return classNames(
		'button',
		'btn', // For backwards compatibility with coreui - should be removed eventually
		{
			[`button-${props.variant}-${props.color}`]: props.variant && props.color,
			[`button-${props.variant}`]: props.variant && !props.color,
			[`button-${props.color}`]: !props.variant && props.color,
			[`button-${props.size}`]: props.size,
			active: props.active,
			disabled: props.disabled,
		},
		props.className
	)
}

export interface ButtonProps
	extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'color' | 'size'>, ButtonVisualProps {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
	{ className, color, variant, size, hidden, active, disabled, children, ...rest },
	ref
) {
	return (
		<ButtonBase
			className={getColorClasses({
				className,
				color,
				variant,
				size,
				hidden,
				active,
				disabled,
			} satisfies Complete<ButtonVisualProps>)}
			{...(active && { 'aria-current': 'page' })}
			{...rest}
			disabled={disabled}
			hidden={hidden}
			ref={ref}
		>
			{children}
		</ButtonBase>
	)
})

interface LinkButtonBaseProps extends React.PropsWithChildren<ButtonVisualProps> {
	title?: string
}

export interface LinkButtonProps<
	TFrom extends string = string,
	TTo extends string | undefined = undefined,
> extends LinkButtonBaseProps {
	to: ToPathOption<RegisteredRouter, TFrom, TTo>
}

export function LinkButton<const TFrom extends string = string, const TTo extends string | undefined = undefined>({
	className,
	color,
	variant,
	size,
	hidden,
	active,
	disabled,
	title,
	to,
	children,
}: LinkButtonProps<TFrom, TTo>): React.JSX.Element {
	return (
		<Link
			className={getColorClasses({ className, color, variant, size, hidden, active, disabled })}
			{...(active && { 'aria-current': 'page' })}
			{...(disabled && { 'aria-disabled': true, tabIndex: -1 })}
			disabled={disabled}
			title={title}
			to={to}
		>
			{children}
		</Link>
	)
}

export interface LinkButtonExternalProps extends LinkButtonBaseProps {
	href: string
	target?: string
	rel?: string
	onClick?: React.MouseEventHandler<HTMLAnchorElement>
}

export function LinkButtonExternal({
	className,
	color,
	variant,
	size,
	hidden,
	active,
	disabled,
	title,
	href,
	target,
	rel,
	onClick,
	children,
}: LinkButtonExternalProps): React.JSX.Element {
	return (
		<a
			className={getColorClasses({ className, color, variant, size, hidden, active, disabled })}
			{...(active && { 'aria-current': 'page' })}
			{...(disabled && { 'aria-disabled': true, tabIndex: -1 })}
			onClick={(event: React.MouseEvent<HTMLAnchorElement>) => {
				event.preventDefault()
				if (!disabled) onClick?.(event)
			}}
			title={title}
			href={href}
			target={target ?? '_blank'}
			rel={rel ?? 'noopener noreferrer'}
		>
			{children}
		</a>
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
		<div className={classNames(vertical ? 'button-group-vertical' : 'button-group', className)} role="group">
			{children}
		</div>
	)
}
