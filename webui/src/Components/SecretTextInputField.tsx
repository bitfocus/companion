import { Input } from '@base-ui/react'
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { useCallback, useRef, useState } from 'react'
import { Button } from './Button'
import { InputGroup } from './Form'

interface SecretTextInputFieldProps {
	id: string | undefined
	tooltip?: string
	placeholder?: string
	value: string
	className?: string
	inputClassName?: string
	setValue: (value: string) => void
	checkValid?: boolean | ((value: string) => boolean)
	immediateValue?: boolean
}

export const SecretTextInputField = observer(function SecretTextInputField({
	id,
	tooltip,
	placeholder,
	value,
	className,
	inputClassName,
	setValue,
	checkValid,
	immediateValue,
}: SecretTextInputFieldProps) {
	const [tmpValue, setTmpValue] = useState<string | null>(null)
	const [showSecretValue, setShowSecretValue] = useState<boolean>(false)

	const storeValue = useCallback(
		(value: string) => {
			if (!immediateValue) setTmpValue(value)
			setValue(value)
		},
		[immediateValue, setValue]
	)
	const doOnChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement> | React.FormEvent<HTMLInputElement>) => storeValue(e.currentTarget.value),
		[storeValue]
	)

	const currentValueRef = useRef<string>()
	currentValueRef.current = value ?? ''
	const focusStoreValue = useCallback(() => {
		if (!immediateValue) setTmpValue(currentValueRef.current ?? '')
	}, [immediateValue])
	const blurClearValue = useCallback(() => {
		setTmpValue(null)
	}, [])

	const toggleShowSecretValue = useCallback(() => setShowSecretValue((prev) => !prev), [])

	const showValue = ((immediateValue ? null : tmpValue) ?? value ?? '').toString()
	const valueIsInvalid = typeof checkValid === 'boolean' ? !checkValid : !!checkValid && !checkValid(showValue)

	return (
		<InputGroup className={className}>
			<Input
				id={id}
				type={showSecretValue ? 'text' : 'password'}
				className={classNames(
					'text-input-field',
					{
						'invalid-value': valueIsInvalid,
					},
					inputClassName
				)}
				value={showValue}
				title={tooltip}
				placeholder={placeholder}
				onChange={doOnChange}
				onFocus={focusStoreValue}
				onBlur={blurClearValue}
			/>
			<Button
				color="secondary"
				className="input-group-borders border-start-0"
				title={showSecretValue ? 'Hide secret' : 'Show secret'}
				aria-label={showSecretValue ? 'Hide secret value' : 'Show secret value'}
				onClick={toggleShowSecretValue}
			>
				<FontAwesomeIcon icon={showSecretValue ? faEyeSlash : faEye} />
			</Button>
		</InputGroup>
	)
})
