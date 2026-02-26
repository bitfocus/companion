import type { CompanionSurfaceConfigField } from '@companion-app/shared/Model/Surfaces.js'
import { CFormSwitch, CFormLabel, CCol } from '@coreui/react'
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import React, { useCallback } from 'react'
import { TextInputField, NumberInputField, DropdownInputField } from '~/Components'
import { ExpressionInputField } from '~/Components/ExpressionInputField'
import { InlineHelp } from '~/Components/InlineHelp'
import { InternalCustomVariableDropdown } from '~/Controls/InternalModuleField'
import { InputFeatureIcons, type InputFeatureIconsProps } from '~/Controls/OptionsInputField'
import { validateInputValue } from '@companion-app/shared/ValidateInputValue.js'
import type { DropdownChoiceInt } from '~/Components/DropdownChoices.js'
import type { JsonValue } from 'type-fest'
import { stringifyVariableValue } from '@companion-app/shared/Model/Variables.js'

interface EditPanelConfigFieldProps {
	setValue: (key: string, value: JsonValue | undefined) => void
	definition: CompanionSurfaceConfigField
	value: JsonValue | undefined
}

const SurfaceLocalVariables: DropdownChoiceInt[] = [
	{
		value: 'this:page',
		label: 'This page',
	},
	{
		value: 'this:surface_id',
		label: 'The id of this surface',
	},
	{
		value: 'this:page_name',
		label: 'This page name',
	},
]

export const EditPanelConfigField = observer(function EditPanelConfigField({
	setValue,
	definition,
	value,
}: EditPanelConfigFieldProps) {
	const id = definition.id
	const checkValid = useCallback(
		(value: JsonValue | undefined) => validateInputValue(definition, value).validationError === undefined,
		[definition]
	)
	const setValue2 = useCallback((val: JsonValue | undefined) => setValue(id, val), [setValue, id])

	let control: JSX.Element | string | undefined = undefined
	let features: InputFeatureIconsProps | undefined

	const fieldType = definition.type
	switch (definition.type) {
		case 'textinput':
			control = (
				<TextInputField
					value={stringifyVariableValue(value) ?? ''}
					placeholder={definition.placeholder}
					multiline={definition.multiline}
					setValue={setValue2}
					checkValid={checkValid}
				/>
			)

			break
		case 'expression':
			features = {
				variables: true,
				local: true,
			}

			control = (
				<ExpressionInputField
					value={stringifyVariableValue(value) ?? ''}
					localVariables={SurfaceLocalVariables}
					setValue={setValue2}
				/>
			)

			break
		case 'number':
			control = (
				<NumberInputField
					min={definition.min}
					max={definition.max}
					step={definition.step}
					range={definition.range}
					value={value as any}
					setValue={setValue2}
					checkValid={checkValid}
					showMinAsNegativeInfinity={definition.showMinAsNegativeInfinity}
					showMaxAsPositiveInfinity={definition.showMaxAsPositiveInfinity}
				/>
			)
			break
		case 'checkbox':
			control = (
				<div style={{ marginRight: 40, marginTop: 2 }}>
					<CFormSwitch color="success" checked={!!value} size="xl" onChange={() => setValue2(!value)} />
				</div>
			)
			break
		case 'dropdown':
			control = (
				<DropdownInputField
					choices={definition.choices}
					allowCustom={definition.allowCustom}
					minChoicesForSearch={definition.minChoicesForSearch}
					regex={definition.regex}
					value={value as any}
					setValue={setValue2}
					checkValid={checkValid}
				/>
			)
			break
		case 'custom-variable':
			control = <InternalCustomVariableDropdown value={value} setValue={setValue2} includeNone={true} />
			break
		default:
			control = <p>Unknown field "{fieldType}"</p>
			break
	}

	return (
		<>
			<CFormLabel className="col-sm-4 col-form-label col-form-label-sm">
				{definition.label}
				<InputFeatureIcons {...features} />
				{definition.tooltip && (
					<InlineHelp help={definition.tooltip}>
						<FontAwesomeIcon style={{ marginLeft: '5px' }} icon={faQuestionCircle} />
					</InlineHelp>
				)}
			</CFormLabel>
			<CCol sm={8}>{control}</CCol>
		</>
	)
})
