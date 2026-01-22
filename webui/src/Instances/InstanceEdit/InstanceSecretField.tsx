import React, { useCallback } from 'react'
import type { SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import { SecretTextInputField } from '~/Components/SecretTextInputField'
import { validateInputValue } from '~/Helpers/validateInputValue'
import type { JsonValue } from 'type-fest'

interface InstanceSecretFieldProps {
	setValue: (value: JsonValue | undefined) => void
	definition: SomeCompanionInputField
	value: JsonValue | undefined
}

export function InstanceSecretField({ setValue, definition, value }: InstanceSecretFieldProps): React.JSX.Element {
	const checkValid = useCallback(
		(value: JsonValue | undefined) => validateInputValue(definition, value) === undefined,
		[definition]
	)

	const fieldType = definition.type
	switch (definition.type) {
		case 'secret-text':
			return <SecretTextInputField value={value as any} setValue={setValue} checkValid={checkValid} />
		default:
			return <p>Unknown secret field "{fieldType}"</p>
	}
}
