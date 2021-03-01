import React, { useEffect, useCallback, useState } from 'react'
import { CCol, CInput, CRow } from '@coreui/react'

export function NumberInputField({ definition, value, setValue, setValid }) {
	const [tmpValue, setTmpValue] = useState(null)

	// Check if the value is valid
	const isValueValid = useCallback(
		(val) => {
			if (val === '') {
				// If required, it must not be empty
				if (definition.required) {
					return false
				}
			} else {
				// If has a value, it must be a number
				if (isNaN(val)) {
					return false
				}

				// Verify the value range
				if (definition.min !== undefined && val < definition.min) {
					return false
				}
				if (definition.max !== undefined && val > definition.max) {
					return false
				}
			}

			return true
		},
		[definition.required, definition.min, definition.max]
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

	const onChange = useCallback(
		(e) => {
			const parsedValue = parseFloat(e.currentTarget.value)
			const processedValue = isNaN(parsedValue) ? e.currentTarget.value : parsedValue
			setTmpValue(processedValue)
			setValue(processedValue)
			setValid?.(isValueValid(processedValue))
		},
		[setValue, setValid, isValueValid]
	)

	// Render the input
	const input = (
		<CInput
			type="number"
			value={tmpValue ?? value ?? 0}
			min={definition.min}
			max={definition.max}
			step={definition.step}
			style={{ color: !isValueValid(tmpValue ?? value) ? 'red' : undefined }}
			title={definition.tooltip}
			onChange={onChange}
			onFocus={() => setTmpValue(value ?? '')}
			onBlur={() => setTmpValue(null)}
		/>
	)

	if (definition.range) {
		return (
			<CRow>
				<CCol sm={12}>{input}</CCol>
				<CCol sm={12}>
					<CInput
						type="range"
						value={tmpValue ?? value ?? 0}
						min={definition.min}
						max={definition.max}
						step={definition.step}
						title={definition.tooltip}
						onChange={onChange}
						onFocus={() => setTmpValue(value ?? '')}
						onBlur={() => setTmpValue(null)}
					/>
				</CCol>
			</CRow>
		)
	} else {
		return input
	}
}
