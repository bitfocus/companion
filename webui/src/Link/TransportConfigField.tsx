import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { useCallback, useId } from 'react'
import type { JsonValue } from 'type-fest'
import type { LinkTransportConfigField } from '@companion-app/shared/Model/Link.js'
import { stringifyVariableValue } from '@companion-app/shared/Model/Variables.js'
import { validateInputValue } from '@companion-app/shared/ValidateInputValue.js'
import { DropdownInputField } from '~/Components/DropdownInputField.js'
import { FormLabel } from '~/Components/Form.js'
import { Grid } from '~/Components/Grid.js'
import { InlineHelpIcon } from '~/Components/InlineHelp.js'
import { NumberInputField } from '~/Components/NumberInputField.js'
import { SecretTextInputField } from '~/Components/SecretTextInputField.js'
import { SwitchInputField } from '~/Components/SwitchInputField.js'
import { TextInputFieldSimple } from '~/Components/TextInputField.js'
import { StaticTextFieldText } from '~/Controls/StaticTextField.js'
import { assertNever } from '~/Resources/util.js'

interface TransportConfigFieldProps {
	definition: LinkTransportConfigField
	value: JsonValue | undefined
	setValue: (value: JsonValue | undefined) => void
	isVisible: boolean
}

/** A row of the transport config editor: the label, and the input for the type of field */
export const TransportConfigField = observer(function TransportConfigField({
	definition,
	value,
	setValue,
	isVisible,
}: TransportConfigFieldProps): React.JSX.Element {
	const checkValid = useCallback(
		(value: JsonValue | undefined) => validateInputValue(definition, value).validity,
		[definition]
	)

	const inputId = useId()

	let control: React.JSX.Element
	switch (definition.type) {
		case 'static-text':
			control = (
				<StaticTextFieldText
					id={inputId}
					value={definition.value}
					label={definition.label}
					tooltip={definition.tooltip}
					allowImages
				/>
			)
			break
		case 'textinput':
			control = (
				<TextInputFieldSimple
					id={inputId}
					value={stringifyVariableValue(value) ?? ''}
					placeholder={definition.placeholder}
					multiline={definition.multiline}
					setValue={setValue}
					checkValid={checkValid}
				/>
			)
			break
		case 'secret-text':
			control = (
				<SecretTextInputField
					id={inputId}
					value={stringifyVariableValue(value) ?? ''}
					setValue={setValue}
					checkValid={checkValid}
				/>
			)
			break
		case 'number':
			control = (
				<NumberInputField
					id={inputId}
					min={definition.min}
					max={definition.max}
					step={definition.step}
					range={definition.range}
					value={value as any}
					setValue={setValue}
					checkValid={checkValid}
					showMinAsNegativeInfinity={definition.showMinAsNegativeInfinity}
					showMaxAsPositiveInfinity={definition.showMaxAsPositiveInfinity}
				/>
			)
			break
		case 'checkbox':
			control = (
				<div className="me-10 mt-0.5">
					<SwitchInputField id={inputId} value={!!value} setValue={setValue} tooltip={definition.tooltip} />
				</div>
			)
			break
		case 'dropdown':
			control = (
				<DropdownInputField
					htmlName={inputId}
					choices={definition.choices}
					allowCustom={definition.allowCustom}
					regex={definition.regex}
					value={value as any}
					setValue={setValue}
					checkValid={checkValid}
				/>
			)
			break
		default:
			assertNever(definition)
			control = <p>Unknown field type</p>
			break
	}

	return (
		<>
			<FormLabel htmlFor={inputId} sm={4} column="sm" className={classNames({ hidden: !isVisible })}>
				{definition.label}
				{definition.tooltip && <InlineHelpIcon className="ms-1">{definition.tooltip}</InlineHelpIcon>}
			</FormLabel>
			<Grid.Col sm={8} className={classNames({ hidden: !isVisible })}>
				{control}
				{definition.description && <div className="form-text">{definition.description}</div>}
			</Grid.Col>
		</>
	)
})
