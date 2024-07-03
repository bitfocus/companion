import React, { useEffect, useCallback } from 'react'
import { CFormCheck, CFormLabel } from '@coreui/react'

interface CheckboxInputFieldProps {
	tooltip?: string
	label?: React.ReactNode
	value: boolean
	setValue: (value: boolean) => void
	setValid?: (valid: boolean) => void
	disabled?: boolean
}

export function CheckboxInputField({ tooltip, label, value, setValue, setValid, disabled }: CheckboxInputFieldProps) {
	// If the value is undefined, populate with the default. Also inform the parent about the validity
	useEffect(() => {
		setValid?.(true)
	}, [setValid])

	const onChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			setValue(!!e.currentTarget.checked)
			setValid?.(true)
		},
		[setValue, setValid]
	)

	return (
		<>
			{label ? <CFormLabel>{label}</CFormLabel> : ''}
			<div className="form-check">
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
