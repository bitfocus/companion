/* eslint-disable react-refresh/only-export-components */
import classNames from 'classnames'
import { forwardRef, type HTMLAttributes } from 'react'

// ─── Row ──────────────────────────────────────────────────────────────────────

export type RowProps = HTMLAttributes<HTMLDivElement>

const Row = forwardRef<HTMLDivElement, RowProps>(function Row({ className, ...rest }, ref) {
	return <div className={classNames('row', className)} {...rest} ref={ref} />
})

// ─── Col ──────────────────────────────────────────────────────────────────────

export type ColBreakpointValue =
	| number
	| boolean
	| 'auto'
	| {
			span?: number | boolean | 'auto'
			offset?: number
			order?: number | 'first' | 'last'
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

const BREAKPOINTS = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'] as const
type Breakpoint = (typeof BREAKPOINTS)[number]

function getColClasses(bp: Breakpoint, value: ColBreakpointValue): string[] {
	// xs has no infix in Bootstrap 5 (col-6, not col-xs-6); others use the breakpoint name
	const infix = bp === 'xs' ? '' : `-${bp}`
	const classes: string[] = []

	if (typeof value === 'boolean') {
		if (value) classes.push(`col${infix}`)
	} else if (value === 'auto') {
		classes.push(`col${infix}-auto`)
	} else if (typeof value === 'number') {
		classes.push(`col${infix}-${value}`)
	} else {
		const { span, offset, order } = value
		if (span === undefined || span === true) {
			classes.push(`col${infix}`)
		} else if (span === 'auto') {
			classes.push(`col${infix}-auto`)
		} else if (typeof span === 'number') {
			classes.push(`col${infix}-${span}`)
		}
		if (offset !== undefined) {
			classes.push(`offset${infix}-${offset}`)
		}
		if (order !== undefined) {
			classes.push(`order${infix}-${order}`)
		}
	}

	return classes
}

// Map a set of breakpoint props to Bootstrap grid classes. Returns [] when none are set; the
// caller decides any fallback (e.g. Col adds a plain 'col', FormLabel adds nothing).
export function getGridColClasses(props: GridBreakpointProps): string[] {
	return BREAKPOINTS.flatMap((bp) => {
		const value = props[bp]
		return value !== undefined ? getColClasses(bp, value) : []
	})
}

const Col = forwardRef<HTMLDivElement, ColProps>(function Col({ className, xs, sm, md, lg, xl, xxl, ...rest }, ref) {
	const bpClasses = getGridColClasses({ xs, sm, md, lg, xl, xxl })

	// If no breakpoint props provided, fall back to a plain 'col'
	const colClasses = bpClasses.length > 0 ? bpClasses : ['col']

	return <div className={classNames(...colClasses, className)} {...rest} ref={ref} />
})

// ─── Container ────────────────────────────────────────────────────────────────

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
	/** When true, renders `container-fluid` (full width). Defaults to `container`. */
	fluid?: boolean
}

const Container = forwardRef<HTMLDivElement, ContainerProps>(function Container({ className, fluid, ...rest }, ref) {
	return <div className={classNames(fluid ? 'container-fluid' : 'container', className)} {...rest} ref={ref} />
})

// ─── Namespace export ─────────────────────────────────────────────────────────

export const Grid = {
	Row,
	Col,
	Container,
}
