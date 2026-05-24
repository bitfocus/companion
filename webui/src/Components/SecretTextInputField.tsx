import { CFormInput, CInputGroup } from '@coreui/react'
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useCallback, useMemo, useRef, useState } from 'react'
import { Button } from './Button'

interface SecretTextInputFieldProps {
	id: string | undefined
	tooltip?: string
	value: string
	style?: React.CSSProperties
	setValue: (value: string) => void
	checkValid?: (value: string) => boolean
}

export const SecretTextInputField = observer(function SecretTextInputField({
	id,
	tooltip,
	value,
	style,
	setValue,
	checkValid,
}: SecretTextInputFieldProps) {
	const [tmpValue, setTmpValue] = useState<string | null>(null)
	const [showSecretValue, setShowSecretValue] = useState<boolean>(false)

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
	currentValueRef.current = value ?? ''
	const focusStoreValue = useCallback(() => setTmpValue(currentValueRef.current ?? ''), [])
	const blurClearValue = useCallback(() => {
		setTmpValue(null)
	}, [])

	const toggleShowSecretValue = useCallback(() => setShowSecretValue((prev) => !prev), [])

	const showValue = (tmpValue ?? value ?? '').toString()

	const extraStyle = useMemo(
		() => ({ color: !!checkValid && !checkValid(showValue) ? 'red' : undefined, ...style }),
		[checkValid, showValue, style]
	)

	// Render the input
	return (
		<>
			<CInputGroup>
				<CFormInput
					id={id}
					type={showSecretValue ? 'text' : 'password'}
					value={showValue}
					style={extraStyle}
					title={tooltip}
					onChange={doOnChange}
					onFocus={focusStoreValue}
					onBlur={blurClearValue}
				/>
				<Button
					color="secondary"
					title={showSecretValue ? 'Hide secret' : 'Show secret'}
					aria-label={showSecretValue ? 'Hide secret value' : 'Show secret value'}
					onClick={toggleShowSecretValue}
				>
					<FontAwesomeIcon icon={showSecretValue ? faEyeSlash : faEye} />
				</Button>
			</CInputGroup>
		</>
	)
})
