import React, { useEffect, useCallback } from 'react'
import { CFormCheck, CFormLabel } from '@coreui/react'
import { InlineHelp } from './InlineHelp.js'

interface CheckboxInputFieldProps {
	tooltip?: string
	label?: React.ReactNode
	value: boolean
	setValue: (value: boolean) => void
	setValid?: (valid: boolean) => void
	disabled?: boolean
	helpText?: string
}

export function CheckboxInputField({
	tooltip,
	label,
	value,
	setValue,
	setValid,
	disabled,
	helpText,
}: CheckboxInputFieldProps) {
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
			<>
				{helpText ? (
					<InlineHelp help={helpText}>{label ? <CFormLabel>{label}</CFormLabel> : ''}</InlineHelp>
				) : label ? (
					<>{label ? <CFormLabel>{label}</CFormLabel> : ''}</>
				) : (
					''
				)}
			</>
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
