import React, { useCallback } from 'react'
import { CFormCheck, CFormLabel } from '@coreui/react'
import { InlineHelp } from './InlineHelp.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleQuestion } from '@fortawesome/free-solid-svg-icons'

interface CheckboxInputFieldProps {
	tooltip?: string
	label?: React.ReactNode
	value: boolean
	setValue: (value: boolean) => void
	disabled?: boolean
	helpText?: string
	inline?: boolean
}

export function CheckboxInputField({
	tooltip,
	label,
	value,
	setValue,
	disabled,
	helpText,
	inline,
}: CheckboxInputFieldProps) {
	const onChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			setValue(!!e.currentTarget.checked)
		},
		[setValue]
	)

	return (
		<>
			<>
				{helpText ? (
					<InlineHelp help={helpText}>
						{label ? (
							<CFormLabel>
								{label} <FontAwesomeIcon size="sm" icon={faCircleQuestion} />
							</CFormLabel>
						) : (
							''
						)}
					</InlineHelp>
				) : label ? (
					<>{label ? <CFormLabel>{label}</CFormLabel> : ''}</>
				) : (
					''
				)}
			</>
			<div
				className="form-check"
				style={
					inline
						? {
								display: 'inline-block',
								verticalAlign: 'middle',
								marginLeft: '1em',
								paddingBottom: '.5em',
								paddingTop: '.3em',
							}
						: {}
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
