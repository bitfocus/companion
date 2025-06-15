import React, { useCallback } from 'react'
import { ConnectionInputField } from '@companion-app/shared/Model/Options.js'
import { SecretTextInputField } from '~/Components/SecretTextInputField'
import { validateInputValue } from '~/Helpers/validateInputValue'

interface ConnectionSecretFieldProps {
	label: React.ReactNode
	setValue: (value: any) => void
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
	definition,
	hasSavedValue,
	editValue,
	isDirty,
}: ConnectionSecretFieldProps): React.JSX.Element {
	const checkValid = useCallback((value: any) => validateInputValue(definition, value) === undefined, [definition])

	const fieldType = definition.type
	switch (definition.type) {
		case 'secret-text':
			return (
				<SecretTextInputField
					label={label}
					hasSavedValue={hasSavedValue}
					editValue={editValue}
					setValue={setValue}
					clearValue={clearValue}
					isDirty={isDirty}
					checkValid={checkValid}
				/>
			)
		default:
			return <p>Unknown secret field "{fieldType}"</p>
	}
}
