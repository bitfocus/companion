import React, { useCallback } from 'react'
import { ConnectionInputField } from '@companion-app/shared/Model/Options.js'
import { SecretTextInputField } from '~/Components/SecretTextInputField'

interface ConnectionSecretFieldProps {
	label: React.ReactNode
	setValue: (value: any) => void
	setValid: (key: string, valid: boolean) => void
	clearValue: () => void
	definition: ConnectionInputField
	hasSavedValue: boolean
	editValue: any
	isDirty: boolean
}

export function ConnectionSecretField({
	label,
	setValue,
	clearValue,
	setValid,
	definition,
	hasSavedValue,
	editValue,
	isDirty,
}: ConnectionSecretFieldProps) {
	const id = definition.id
	const setValid2 = useCallback((valid: boolean) => setValid(id, valid), [setValid, id])

	const fieldType = definition.type
	switch (definition.type) {
		case 'secret-text':
			return (
				<SecretTextInputField
					label={label}
					hasSavedValue={hasSavedValue}
					editValue={editValue}
					required={definition.required}
					setValue={setValue}
					clearValue={clearValue}
					setValid={setValid2}
					isDirty={isDirty}
				/>
			)
		default:
			return <p>Unknown secret field "{fieldType}"</p>
	}
}
