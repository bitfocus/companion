import { forwardRef, type FormHTMLAttributes } from 'react'

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
