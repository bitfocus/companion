import React, { useCallback } from 'react'
import { SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import { SecretTextInputField } from '~/Components/SecretTextInputField'
import { validateInputValue } from '~/Helpers/validateInputValue'

interface ConnectionSecretFieldProps {
	setValue: (value: any) => void
	definition: SomeCompanionInputField
	value: any
}

export function ConnectionSecretField({ setValue, definition, value }: ConnectionSecretFieldProps): React.JSX.Element {
	const checkValid = useCallback((value: any) => validateInputValue(definition, value) === undefined, [definition])

	const fieldType = definition.type
	switch (definition.type) {
		case 'secret-text':
			return <SecretTextInputField value={value} setValue={setValue} checkValid={checkValid} />
		default:
			return <p>Unknown secret field "{fieldType}"</p>
	}
}
