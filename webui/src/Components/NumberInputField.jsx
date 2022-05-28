import React, { useEffect, useCallback, useState } from 'react'
import { CButton, CCol, CInput, CInputGroup, CInputGroupAppend, CRow } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHashtag, faDollarSign } from '@fortawesome/free-solid-svg-icons'
import { parse } from '@estilles/expression-parser'
import { InputWithVariables } from './TextWithVariablesInputField'

const variablePattern = /^\$\(((?:[^:$)]+):(?:[^)$]+))\)/

export function NumberInputField({ definition, value, setValue, setValid }) {
	const isExpression = typeof value === 'string' && definition.allowExpression
	const [expressionMode, setExpressionMode] = useState(!!isExpression)
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
				if (expressionMode) {
					try {
						// Make sure it can parse
						parse(val, variablePattern)
					} catch (e) {
						// Clearly not valid
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
			}

			return true
		},
		[definition.required, definition.min, definition.max, expressionMode]
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
			let processedValue = e.currentTarget.value
			if (!expressionMode) {
				const parsedValue = parseFloat(processedValue)
				processedValue = isNaN(parsedValue) ? processedValue : parsedValue
			}

			setTmpValue(processedValue)
			setValue(processedValue)
			setValid?.(isValueValid(processedValue))
		},
		[setValue, setValid, isValueValid, expressionMode]
	)

	const toggleExpression = useCallback(() => {
		setExpressionMode((old) => !old)
	}, [])

	// Render the input
	let input = (
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

	if (definition.allowExpression) {
		input = (
			<CInputGroup>
				{expressionMode ? (
					<InputWithVariables
						style={{ color: !isValueValid(tmpValue ?? value) ? 'red' : undefined }}
						value={tmpValue ?? value ?? ''}
						title={definition.tooltip}
						onChange={onChange}
						onFocus={() => setTmpValue(value ?? '')}
						onBlur={() => setTmpValue(null)}
					/>
				) : (
					input
				)}
				<CInputGroupAppend>
					<CButton
						color="info"
						variant="outline"
						onClick={toggleExpression}
						title={expressionMode ? 'Switch to number mode' : 'Switch to expression mode'}
					>
						<FontAwesomeIcon icon={expressionMode ? faHashtag : faDollarSign} />
					</CButton>
				</CInputGroupAppend>
			</CInputGroup>
		)
	}

	if (definition.range && !expressionMode) {
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
