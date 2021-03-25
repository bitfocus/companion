import { useEffect, useMemo, useState, useCallback } from 'react'
import { CInput } from '@coreui/react'

export function TextInputField({ definition, value, setValue, setValid }) {
	const [tmpValue, setTmpValue] = useState(null)

	// Compile the regex (and cache)
	const regex = useMemo(() => {
		if (definition.regex) {
			// Compile the regex string
			const match = definition.regex.match(/^\/(.*)\/(.*)$/)
			if (match) {
				return new RegExp(match[1], match[2])
			}
		}
		return null
	}, [definition.regex])

	// Check if the value is valid
	const isValueValid = useCallback(
		(val) => {
			// We need a string here, but sometimes get a number...
			if (typeof val === 'number') {
				val = `${val}`
			}

			// Must match the regex
			if (regex && (typeof val !== 'string' || !val.match(regex))) {
				return false
			}

			// if required, must not be empty
			if (definition.required && val === '') {
				return false
			}

			return true
		},
		[regex, definition.required]
	)

	// If the value is undefined, populate with the default. Also inform the parent about the validity
	useEffect(() => {
		if (value === undefined && definition.default !== undefined) {
			setValue(definition.default)
			setValid?.(isValueValid(definition.default))
		} else {
			setValid?.(isValueValid(value))
		}
	}, [isValueValid, definition.default, value, setValue, setValid])

	// Render the input
	return (
		<CInput
			type="text"
			value={tmpValue ?? value ?? ''}
			style={{ color: !isValueValid(tmpValue ?? value) ? 'red' : undefined }}
			title={definition.tooltip}
			onChange={(e) => {
				setTmpValue(e.currentTarget.value)
				setValue(e.currentTarget.value)
				setValid?.(isValueValid(e.currentTarget.value))
			}}
			onFocus={() => setTmpValue(value ?? '')}
			onBlur={() => setTmpValue(null)}
		/>
	)
}
