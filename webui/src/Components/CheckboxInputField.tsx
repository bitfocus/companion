import React, { useCallback } from 'react'
import { CFormCheck } from '@coreui/react'

interface CheckboxInputFieldProps {
	tooltip?: string
	value: boolean
	setValue: (value: boolean) => void
	disabled?: boolean
	inline?: boolean
}

export function CheckboxInputField({
	tooltip,
	value,
	setValue,
	disabled,
	inline,
}: CheckboxInputFieldProps): React.JSX.Element {
	const onChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			setValue(!!e.currentTarget.checked)
		},
		[setValue]
	)

	return (
		<>
			<div
				className="form-check"
				style={
					inline
						? {
								display: 'inline-flex',
								alignItems: 'center',
								verticalAlign: 'middle',
								marginLeft: '1em',
								paddingBottom: '.5em',
								paddingTop: '.3em',
							}
						: { display: 'flex', alignItems: 'center' }
				}
			>
				<CFormCheck
					type="checkbox"
					disabled={disabled}
					checked={!!value}
					value={true as any}
					title={tooltip}
					onChange={onChange}
				/>
			</div>
		</>
	)
}
