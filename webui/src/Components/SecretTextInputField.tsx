import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { CButton, CFormInput, CFormLabel, CInputGroup } from '@coreui/react'
import { observer } from 'mobx-react-lite'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSync } from '@fortawesome/free-solid-svg-icons'

interface SecretTextInputFieldProps {
	label?: React.ReactNode
	required?: boolean
	tooltip?: string
	hasSavedValue: boolean
	editValue: string
	style?: React.CSSProperties
	setValue: (value: string) => void
	clearValue: () => void
	setValid?: (valid: boolean) => void
	isDirty: boolean
}

export const SecretTextInputField = observer(function SecretTextInputField({
	label,
	required,
	tooltip,
	hasSavedValue,
	editValue,
	style,
	setValue,
	clearValue,
	setValid,
	isDirty,
}: SecretTextInputFieldProps) {
	const [tmpValue, setTmpValue] = useState<string | null>(null)

	// Check if the value is valid
	const isValueValid = useCallback(
		(val: string) => {
			// We need a string here, but sometimes get a number...
			if (typeof val === 'number') {
				val = `${val}`
			}

			// if required, must not be empty
			if (required && val === '') {
				return false
			}

			return true
		},
		[required]
	)

	// If the value is undefined, populate with the default. Also inform the parent about the validity
	useEffect(() => {
		setValid?.(isValueValid(editValue))
	}, [isValueValid, editValue, setValid])

	const storeValue = useCallback(
		(value: string) => {
			setTmpValue(value)
			setValue(value)
			setValid?.(isValueValid(value))
		},
		[setValue, setValid, isValueValid]
	)
	const doOnChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement> | React.FormEvent<HTMLInputElement>) => storeValue(e.currentTarget.value),
		[storeValue]
	)

	const currentValueRef = useRef<string>()
	currentValueRef.current = editValue ?? ''
	const focusStoreValue = useCallback(() => setTmpValue(currentValueRef.current ?? ''), [])
	const blurClearValue = useCallback(() => {
		setTmpValue(null)
	}, [])

	const showValue = (tmpValue ?? editValue ?? '').toString()

	const extraStyle = useMemo(
		() => ({ color: !isValueValid(showValue) ? 'red' : undefined, ...style }),
		[isValueValid, showValue, style]
	)

	// Render the input
	return (
		<>
			<CFormLabel>{label}</CFormLabel>
			<CInputGroup>
				<CFormInput
					type="text"
					value={showValue}
					style={extraStyle}
					title={tooltip}
					onChange={doOnChange}
					onFocus={focusStoreValue}
					onBlur={blurClearValue}
					placeholder={hasSavedValue && !isDirty ? '●●●●●' : undefined}
				/>
				<CButton color="secondary" title="Discard changes" onClick={clearValue} disabled={!isDirty}>
					<FontAwesomeIcon icon={faSync} />
				</CButton>
			</CInputGroup>
		</>
	)
})
