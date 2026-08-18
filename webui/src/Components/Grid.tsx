/* eslint-disable react-refresh/only-export-components */
import classNames from 'classnames'
import { forwardRef, type HTMLAttributes } from 'react'

// The 12-column layout grid. `.row`/`.page-container` live in src/layout-grid.css; the columns are the
// Tailwind `col-span-*`/`col-start-*` utilities emitted from here. Those class names are built by
// interpolation, so tailwind.css safelists them with `@source inline(...)` — keep the two in step.

// ─── Shared ───────────────────────────────────────────────────────────────────

const DEFAULT_COLUMN_COUNT = 12

const BREAKPOINTS = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'] as const
type Breakpoint = (typeof BREAKPOINTS)[number]

/** `xs` is the unprefixed base, and Tailwind calls the 1400px breakpoint `2xl` rather than `xxl`. */
const VARIANT_PREFIX: Record<Breakpoint, string> = {
	xs: '',
	sm: 'sm:',
	md: 'md:',
	lg: 'lg:',
	xl: 'xl:',
	xxl: '2xl:',
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(Math.round(value), min), max)
}

// ─── Row ──────────────────────────────────────────────────────────────────────

export interface RowProps extends HTMLAttributes<HTMLDivElement> {
	/** How many columns the row is divided into. Defaults to 12; spans are counted in these columns. */
	columns?: number
}

const Row = forwardRef<HTMLDivElement, RowProps>(function Row({ className, columns, ...rest }, ref) {
	return (
		<div
			className={classNames(
				'row',
				columns !== undefined && `grid-cols-${clamp(columns, 1, DEFAULT_COLUMN_COUNT)}`,
				className
			)}
			{...rest}
			ref={ref}
		/>
	)
})

// ─── Col ──────────────────────────────────────────────────────────────────────

export type ColBreakpointValue =
	| number
	| {
			span?: number
			/** Number of columns to leave empty before this one, counted from the start of the row. */
			offset?: number
	  }

export interface GridBreakpointProps {
	xs?: ColBreakpointValue
	sm?: ColBreakpointValue
	md?: ColBreakpointValue
	lg?: ColBreakpointValue
	xl?: ColBreakpointValue
	xxl?: ColBreakpointValue
}

export interface ColProps extends HTMLAttributes<HTMLDivElement>, GridBreakpointProps {}

function getColClasses(bp: Breakpoint, value: ColBreakpointValue): string[] {
	const prefix = VARIANT_PREFIX[bp]
	const { span, offset } = typeof value === 'number' ? { span: value, offset: undefined } : value

	const classes: string[] = []

	if (span !== undefined) {
		classes.push(`${prefix}col-span-${clamp(span, 1, DEFAULT_COLUMN_COUNT)}`)
	}

	if (offset !== undefined) {
		// An offset places the column absolutely, so offset 1 means "start in the second column".
		const start = clamp(offset, 0, DEFAULT_COLUMN_COUNT - 1)
		classes.push(start > 0 ? `${prefix}col-start-${start + 1}` : `${prefix}col-start-auto`)
	}

	return classes
}

/** Map breakpoint props to column classes. Returns [] when none are set: `.row > *` then fills the row. */
export function getGridColClasses(props: GridBreakpointProps): string[] {
	return BREAKPOINTS.flatMap((bp) => {
		const value = props[bp]
		return value !== undefined ? getColClasses(bp, value) : []
	})
}

const Col = forwardRef<HTMLDivElement, ColProps>(function Col({ className, xs, sm, md, lg, xl, xxl, ...rest }, ref) {
	const bpClasses = getGridColClasses({ xs, sm, md, lg, xl, xxl })

	return <div className={classNames(...bpClasses, className)} {...rest} ref={ref} />
})

// ─── Container ────────────────────────────────────────────────────────────────

export type ContainerProps = HTMLAttributes<HTMLDivElement>

const Container = forwardRef<HTMLDivElement, ContainerProps>(function Container({ className, ...rest }, ref) {
	return <div className={classNames('page-container', className)} {...rest} ref={ref} />
})

// ─── Namespace export ─────────────────────────────────────────────────────────

export const Grid = {
	Row,
	Col,
	Container,
}
