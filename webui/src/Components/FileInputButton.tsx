import { useCallback, useRef } from 'react'
import { Button, type ButtonProps } from './Button.js'

export interface FileInputButtonProps extends Omit<ButtonProps, 'onChange'> {
	/** Passed to the file input, e.g. `image/*` or `.tgz` */
	accept: string | undefined
	onFileSelected: (file: File) => void
}

/**
 * A button which opens the browser's file picker
 */
export function FileInputButton({
	accept,
	onFileSelected,
	onClick,
	disabled,
	...rest
}: FileInputButtonProps): React.JSX.Element {
	const inputRef = useRef<HTMLInputElement>(null)

	const handleClick = useCallback(
		(e: React.MouseEvent<HTMLButtonElement>) => {
			onClick?.(e)
			inputRef.current?.click()
		},
		[onClick]
	)

	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.currentTarget.files?.[0]
			// Reset, so that picking the same file again still fires a change
			e.currentTarget.value = ''

			if (file) onFileSelected(file)
		},
		[onFileSelected]
	)

	return (
		<>
			<Button {...rest} disabled={disabled} onClick={handleClick} />
			{/* eslint-disable-next-line react/forbid-elements -- This is the wrapper */}
			<input
				ref={inputRef}
				type="file"
				accept={accept}
				className="hidden"
				onChange={handleChange}
				disabled={disabled}
			/>
		</>
	)
}
