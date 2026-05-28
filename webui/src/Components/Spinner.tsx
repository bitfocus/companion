import classNames from 'classnames'
import type { CSSProperties, ElementType, HTMLAttributes } from 'react'

const spinnerSemanticColors: Record<string, string> = {
	primary: 'var(--cui-primary)',
	secondary: 'var(--cui-secondary)',
	success: 'var(--cui-success)',
	danger: 'var(--cui-danger)',
	error: 'var(--cui-danger)',
	warning: 'var(--cui-warning)',
	info: 'var(--cui-info)',
	light: 'var(--cui-light)',
	dark: 'var(--cui-dark)',
}

function resolveSpinnerColor(color: string | undefined): string | undefined {
	if (!color) return undefined

	return spinnerSemanticColors[color] ?? color
}

export interface SpinnerProps extends HTMLAttributes<HTMLDivElement | HTMLSpanElement> {
	as?: ElementType
	className?: string
	color?: string
	size?: 'sm'
	variant?: 'border' | 'grow'
	visuallyHiddenLabel?: string
}

export function Spinner({
	as,
	className,
	color,
	size,
	variant = 'border',
	visuallyHiddenLabel = 'Loading...',
	style,
	...props
}: SpinnerProps): JSX.Element {
	const Component = as ?? 'div'
	const resolvedColor = resolveSpinnerColor(color)

	const spinnerStyle: CSSProperties = {
		...(resolvedColor ? { color: resolvedColor } : undefined),
		...style,
	}

	return (
		<Component
			className={classNames('spinner2', `spinner2-${variant}`, size === 'sm' && 'spinner2-sm', className)}
			style={spinnerStyle}
			role="status"
			{...props}
		>
			<span className="visually-hidden">{visuallyHiddenLabel}</span>
		</Component>
	)
}
