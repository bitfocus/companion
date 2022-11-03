import { useEffect, useMemo, useState, useCallback } from 'react'
import { CInput } from '@coreui/react'

export function TextInputField({ regex, required, tooltip, placeholder, value, setValue, setValid, disabled }) {
	const [tmpValue, setTmpValue] = useState(null)

	// Compile the regex (and cache)
	const compiledRegex = useMemo(() => {
		if (regex) {
			// Compile the regex string
			const match = regex.match(/^\/(.*)\/(.*)$/)
			if (match) {
				return new RegExp(match[1], match[2])
			}
		}
		return null
	}, [regex])

	// Check if the value is valid
	const isValueValid = useCallback(
		(val) => {
			// We need a string here, but sometimes get a number...
			if (typeof val === 'number') {
				val = `${val}`
			}

			// Must match the regex, if required or has a value
			if (required || val !== '') {
				if (compiledRegex && (typeof val !== 'string' || !val.match(compiledRegex))) {
					return false
				}
			}

			// if required, must not be empty
			if (required && val === '') {
				return false
			}

			return true
		},
		[compiledRegex, required]
	)

	// If the value is undefined, populate with the default. Also inform the parent about the validity
	useEffect(() => {
		setValid?.(isValueValid(value))
	}, [isValueValid, value, setValid])

	// Render the input
	return (
		<CInput
			type="text"
			disabled={disabled}
			value={tmpValue ?? value ?? ''}
			style={{ color: !isValueValid(tmpValue ?? value) ? 'red' : undefined }}
			title={tooltip}
			onChange={(e) => {
				setTmpValue(e.currentTarget.value)
				setValue(e.currentTarget.value)
				setValid?.(isValueValid(e.currentTarget.value))
			}}
			onFocus={() => setTmpValue(value ?? '')}
			onBlur={() => setTmpValue(null)}
			placeholder={placeholder}
		/>
	)
}
