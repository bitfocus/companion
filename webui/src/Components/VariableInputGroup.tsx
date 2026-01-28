import React, { useState, useRef, useEffect } from 'react'
import { CInputGroup, CButton, CFormInput } from '@coreui/react'
import JSON5 from 'json5'
import { VariableTypeIcon } from './VariableTypeIcon.js'
import type { JsonValue } from 'type-fest'

interface VariableInputGroupProps {
	value: JsonValue | undefined // The external variable value
	setCurrentValue: (name: string, value: JsonValue | undefined) => void
	name: string
	disabled?: boolean
}

const VariableInputGroup: React.FC<VariableInputGroupProps> = ({ value, setCurrentValue, name, disabled = false }) => {
	// Determine initial type
	const isStringInitial = typeof value === 'string'

	// Local editing state
	const [isEditing, setIsEditing] = useState(false)
	const [localValue, setLocalValue] = useState<string>(isStringInitial ? (value ?? '') : JSON.stringify(value))
	const [isValueValid, setIsValid] = useState<boolean>(true)
	const [isString, setIsString] = useState<boolean>(isStringInitial)

	// Ref for the input group to manage focus
	const groupRef = useRef<HTMLDivElement>(null)

	// When entering editing mode, sync local state to external value
	useEffect(() => {
		if (!isEditing) {
			const newIsString = typeof value === 'string'
			setIsString(newIsString)
			setLocalValue(newIsString ? (value ?? '') : JSON.stringify(value))
			setIsValid(true)
		}
	}, [value, isEditing])

	// Focus/blur handling for the group
	const handleFocus = () => {
		setIsEditing(true)
	}

	const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
		// Only end editing if focus moves outside the group
		if (groupRef.current && !groupRef.current.contains(e.relatedTarget as Node)) {
			setIsEditing(false)
		}
	}

	// Handle button toggle
	const handleToggle = () => {
		if (isString) {
			// Switching from string to JSON mode
			setIsString(false)
			setLocalValue(JSON.stringify(localValue))
			// No variable update
		} else {
			// Switching from JSON to string mode
			if (typeof value === 'string') {
				setIsString(true)
				setLocalValue(value ?? '')
				// No variable update
			} else {
				const stringified = JSON.stringify(value)
				setIsString(true)
				setLocalValue(stringified)
				setCurrentValue(name, stringified) // Update variable
			}
		}
		setIsValid(true)
	}

	// Handle text input change
	const handleInputChange = (val: string) => {
		setLocalValue(val)
		if (isString) {
			setCurrentValue(name, val)
			setIsValid(true)
		} else {
			try {
				const parsed = JSON5.parse(val)
				setCurrentValue(name, parsed)
				setIsValid(true)
			} catch {
				// Do not update if invalid JSON
				setIsValid(false)
			}
		}
	}

	// Button appearance
	const buttonProps = isString
		? {
				title: 'String entry',
				style: { color: '#0000cc', boxSizing: 'content-box' as const, height: '24px' },
				label: <VariableTypeIcon width={14} height={14} fill="#0000cc" icon="string" />,
			}
		: {
				title: 'JSON entry',
				style: { color: '#cc0000', boxSizing: 'content-box' as const, height: '24px' },
				label: <VariableTypeIcon width={14} height={14} fill="#cc0000" icon="object" />,
			}

	return (
		<div
			style={{
				display: 'inline-block',
				width: '100%',
			}}
		>
			<CInputGroup
				ref={groupRef}
				tabIndex={0}
				onFocus={handleFocus}
				onBlur={handleBlur}
				style={{
					boxShadow: isEditing && !disabled ? 'rgba(213, 2, 21, 0.25) 0px 0px 0px 0.25rem' : 'none',
					transition: 'box-shadow 0.15s ease-in-out',
					borderRadius: 'var(--cui-border-radius)',
					outline: 'none',
					marginBottom: '0.5rem',
				}}
			>
				<CButton
					color={disabled ? '#888888' : 'info'}
					style={buttonProps.style}
					variant="outline"
					title={buttonProps.title}
					onClick={handleToggle}
					tabIndex={-1} // So the group receives focus, not the button
					disabled={disabled}
				>
					{buttonProps.label}
				</CButton>
				<CFormInput
					value={localValue}
					onChange={(e) => handleInputChange(e.target.value)}
					style={{ outline: 'none', boxShadow: 'none', color: !isValueValid ? 'red' : undefined }}
					onFocus={handleFocus}
					onBlur={() => {}} // Prevent input blur from ending editing (handled by group)
					disabled={disabled}
				/>
			</CInputGroup>
		</div>
	)
}

export default VariableInputGroup
