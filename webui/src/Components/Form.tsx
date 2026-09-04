import classNames from 'classnames'
import './form.css'
import { forwardRef, type FormHTMLAttributes, type HTMLAttributes, type LabelHTMLAttributes } from 'react'
import { getGridColClasses, type GridBreakpointProps } from './Grid.js'

export interface FormProps extends FormHTMLAttributes<HTMLFormElement> {
	/**
	 * A string of all className you want applied to the component.
	 */
	className?: string

	/** Lay the form out as a grid row, so its own `Grid.Col` children don't need a `Grid.Row`. */
	row?: boolean
}

export const Form = forwardRef<HTMLFormElement, FormProps>(({ children, className, row, ...rest }, ref) => {
	return (
		<form className={classNames(row && 'row', className)} {...rest} ref={ref}>
			{children}
		</form>
	)
})

export interface FormLabelProps extends LabelHTMLAttributes<HTMLLabelElement>, GridBreakpointProps {
	/**
	 * A string of all className you want applied to the component.
	 */
	className?: string

	/**
	 * The id of the form element this label is associated with. This is required for accessibility reasons.
	 */
	htmlFor: string | undefined

	/**
	 * Style as a column label in a horizontal form (vertical padding to align with the adjacent
	 * input). Pass 'sm'/'lg' to also size it.
	 */
	column?: boolean | 'sm' | 'lg'
}

export const FormLabel = forwardRef<HTMLLabelElement, FormLabelProps>(
	({ children, className, column, xs, sm, md, lg, xl, xxl, ...rest }, ref) => {
		const classes = classNames(
			'form-label',
			getGridColClasses({ xs, sm, md, lg, xl, xxl }),
			column && 'col-form-label',
			typeof column === 'string' && `col-form-label-${column}`,
			className
		)
		return (
			<label className={classes} {...rest} ref={ref}>
				{children}
			</label>
		)
	}
)

export type InputGroupProps = HTMLAttributes<HTMLDivElement>

export const InputGroup = forwardRef<HTMLDivElement, InputGroupProps>(({ children, className, ...rest }, ref) => {
	return (
		<div className={classNames('input-group2', className)} {...rest} ref={ref}>
			{children}
		</div>
	)
})

export const InputGroupText = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
	({ children, className, ...rest }, ref) => {
		return (
			<div className={classNames('input-group2-text', className)} {...rest} ref={ref}>
				{children}
			</div>
		)
	}
)
