import React, { useEffect, useCallback } from 'react'
import { CInputCheckbox } from '@coreui/react'

interface CheckboxInputFieldProps {
	tooltip?: string
	value: boolean
	setValue: (value: boolean) => void
	setValid?: (valid: boolean) => void
	disabled?: boolean
}

export function CheckboxInputField({ tooltip, value, setValue, setValid, disabled }: CheckboxInputFieldProps) {
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
		<CInputCheckbox
			type="checkbox"
			disabled={disabled}
			checked={!!value}
			value={true as any}
			title={tooltip}
			onChange={onChange}
		/>
	)
}
