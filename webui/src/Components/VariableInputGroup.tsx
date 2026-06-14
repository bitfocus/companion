import { Input } from '@base-ui/react'
import classNames from 'classnames'
import JSON5 from 'json5'
import { useEffect, useRef, useState } from 'react'
import type { JsonValue } from 'type-fest'
import { Button } from '~/Components/Button.js'
import { InputGroup } from './Form.js'
import { VariableTypeIcon } from './VariableTypeIcon.js'

interface VariableInputGroupProps {
	id: string | undefined
	value: JsonValue | undefined // The external variable value
	setValue: (value: JsonValue | undefined) => void
	disabled?: boolean
	title?: string
}

const VariableInputGroup: React.FC<VariableInputGroupProps> = ({ id, value, setValue, disabled = false, title }) => {
	// Determine initial type
	const isStringInitial = typeof value === 'string'

	// Local editing state
	const [isEditing, setIsEditing] = useState(false)
	// note: localValue can't be "undefined" in order to avoid React controlled/uncontrolled errors
	const [localValue, setLocalValue] = useState((isStringInitial ? value : JSON.stringify(value)) ?? '')
	const [isValueValid, setIsValid] = useState(true)
	const [isString, setIsString] = useState(isStringInitial)

	// Ref for the input group to manage focus
	const groupRef = useRef<HTMLDivElement>(null)

	// When entering editing mode, sync local state to external value
	useEffect(() => {
		if (!isEditing) {
			const newIsString = typeof value === 'string'
			setIsString(newIsString)
			setLocalValue((newIsString ? value : JSON.stringify(value)) ?? '')
			setIsValid(true)
		}
	}, [value, isEditing])

	// Focus/blur handling for the group
	const handleFocus = () => {
		setIsEditing(true)
	}

	const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
		// Only end editing if focus moves outside the group
		if (groupRef.current && !groupRef.current.contains(e.relatedTarget)) {
			setIsEditing(false)
		}
	}

	// Handle button toggle
	const handleToggle = () => {
		if (isString) {
			// Switching from string to JSON mode
			setIsString(false)
			setLocalValue(JSON.stringify(localValue) ?? '')
			// No variable update
		} else {
			// Switching from JSON to string mode
			if (typeof value === 'string') {
				setIsString(true)
				setLocalValue(value ?? '')
				// No variable update
			} else {
				const stringified = JSON.stringify(value) ?? ''
				setIsString(true)
				setLocalValue(stringified)
				setValue(stringified) // Update variable
			}
		}
		setIsValid(true)
	}

	// Handle text input change
	const handleInputChange = (val: string) => {
		setLocalValue(val)
		if (isString) {
			setValue(val)
			setIsValid(true)
		} else {
			try {
				const parsed = JSON5.parse(val)
				setValue(parsed)
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
				label: <VariableTypeIcon width={14} height={14} fill="#0000cc" icon="string" />,
			}
		: {
				title: 'JSON entry',
				label: <VariableTypeIcon width={14} height={14} fill="#cc0000" icon="object" />,
			}

	return (
		<div
			title={title}
			style={{
				display: 'inline-block',
				width: '100%',
			}}
		>
			<InputGroup
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
				<Button
					color="info"
					variant="outline"
					title={buttonProps.title}
					onClick={handleToggle}
					tabIndex={-1} // So the group receives focus, not the button
					disabled={disabled}
				>
					{buttonProps.label}
				</Button>

				<Input
					id={id}
					type="text"
					className={classNames('text-input-field no-focus', { 'invalid-value': !isValueValid })}
					// render={multiline ? <textarea rows={2} /> : undefined}
					disabled={disabled}
					value={localValue}
					onChange={(e) => handleInputChange(e.target.value)}
					onFocus={handleFocus}
					onBlur={() => {}} // Prevent input blur from ending editing (handled by group)
				/>
			</InputGroup>
		</div>
	)
}

export default VariableInputGroup
