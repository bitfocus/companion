import classNames from 'classnames'
import './Table.css'
import { forwardRef, type TableHTMLAttributes } from 'react'

export interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
	/**
	 * A string of all className you want applied to the component.
	 */
	className?: string

	/**
	 * Condensed cell padding (`table-sm`).
	 */
	size?: 'sm'

	/**
	 * Zebra-stripe the body rows (`table-striped`).
	 */
	striped?: boolean

	/**
	 * The framed style that scrolls horizontally on small screens (`table-responsive-sm`).
	 * Defaults to `true` — pass `false` for a plain, unframed table.
	 */
	responsive?: boolean
}

export const Table = forwardRef<HTMLTableElement, TableProps>(
	({ children, className, size, striped, responsive = true, ...rest }, ref) => {
		const classes = classNames(
			'table',
			size && `table-${size}`,
			striped && 'table-striped',
			responsive && 'table-responsive-sm',
			className
		)
		return (
			<table className={classes} {...rest} ref={ref}>
				{children}
			</table>
		)
	}
)
