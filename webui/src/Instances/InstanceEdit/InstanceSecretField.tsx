import { useCallback } from 'react'
import type { SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import { SecretTextInputField } from '~/Components/SecretTextInputField'
import { checkInputValueIsGood } from '@companion-app/shared/ValidateInputValue.js'
import type { JsonValue } from 'type-fest'
import { stringifyVariableValue } from '@companion-app/shared/Model/Variables.js'

interface InstanceSecretFieldProps {
	setValue: (value: JsonValue | undefined) => void
	definition: SomeCompanionInputField
	value: JsonValue | undefined
}

export function InstanceSecretField({ setValue, definition, value }: InstanceSecretFieldProps): React.JSX.Element {
	const checkValid = useCallback(
		(value: JsonValue | undefined) => checkInputValueIsGood(definition, value),
		[definition]
	)

	const fieldType = definition.type
	switch (definition.type) {
		case 'secret-text':
			return (
				<SecretTextInputField value={stringifyVariableValue(value) ?? ''} setValue={setValue} checkValid={checkValid} />
			)
		default:
			return <p>Unknown secret field "{fieldType}"</p>
	}
}
