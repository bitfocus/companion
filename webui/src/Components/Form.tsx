import classNames from 'classnames'
import { forwardRef, type FormHTMLAttributes, type HTMLAttributes, type LabelHTMLAttributes } from 'react'

export interface FormProps extends FormHTMLAttributes<HTMLFormElement> {
	/**
	 * A string of all className you want applied to the component.
	 */
	className?: string
}

export const Form = forwardRef<HTMLFormElement, FormProps>(({ children, ...rest }, ref) => {
	return (
		<form {...rest} ref={ref}>
			{children}
		</form>
	)
})

export interface FormLabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
	/**
	 * A string of all className you want applied to the component.
	 */
	className?: string

	/**
	 * The id of the form element this label is associated with. This is required for accessibility reasons.
	 */
	htmlFor: string | undefined
}

export const FormLabel = forwardRef<HTMLLabelElement, FormLabelProps>(({ children, className, ...rest }, ref) => {
	return (
		<label className={classNames('form-label2', className)} {...rest} ref={ref}>
			{children}
		</label>
	)
})

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
