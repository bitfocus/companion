import React, { useMemo, useState, useCallback, useRef } from 'react'
import { CButton, CFormInput, CInputGroup } from '@coreui/react'
import { observer } from 'mobx-react-lite'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSync } from '@fortawesome/free-solid-svg-icons'

interface SecretTextInputFieldProps {
	tooltip?: string
	hasSavedValue: boolean
	editValue: string
	style?: React.CSSProperties
	setValue: (value: string) => void
	clearValue: () => void
	isDirty: boolean
	checkValid?: (value: string) => boolean
}

export const SecretTextInputField = observer(function SecretTextInputField({
	tooltip,
	hasSavedValue,
	editValue,
	style,
	setValue,
	clearValue,
	isDirty,
	checkValid,
}: SecretTextInputFieldProps) {
	const [tmpValue, setTmpValue] = useState<string | null>(null)

	const storeValue = useCallback(
		(value: string) => {
			setTmpValue(value)
			setValue(value)
		},
		[setValue]
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
		() => ({ color: !!checkValid && !checkValid(showValue) ? 'red' : undefined, ...style }),
		[checkValid, showValue, style]
	)

	// Render the input
	return (
		<>
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
