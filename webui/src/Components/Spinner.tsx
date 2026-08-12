import classNames from 'classnames'
import './Spinner.css'
import type { CSSProperties, ElementType, HTMLAttributes } from 'react'

const spinnerSemanticColors: Record<string, string> = {
	primary: 'var(--color-primary)',
	secondary: 'var(--color-secondary)',
	success: 'var(--color-success)',
	danger: 'var(--color-danger)',
	error: 'var(--color-danger)',
	warning: 'var(--color-warning)',
	info: 'var(--color-info)',
	light: 'var(--color-light)',
	dark: 'var(--color-dark)',
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
}: SpinnerProps): React.JSX.Element {
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
			<span className="sr-only">{visuallyHiddenLabel}</span>
		</Component>
	)
}
