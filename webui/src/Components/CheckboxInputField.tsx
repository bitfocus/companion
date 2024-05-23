import React, { useEffect, useCallback } from 'react'
import { CFormCheck } from '@coreui/react'

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
		(e) => {
			setValue(!!e.currentTarget.checked)
			setValid?.(true)
		},
		[setValue, setValid]
	)

	return (
		<CFormCheck
			type="checkbox"
			label={label}
			disabled={disabled}
			checked={!!value}
			value={true as any}
			title={tooltip}
			onChange={onChange}
		/>
	)
}
