import { CCol, CFormLabel, CInputGroupText } from '@coreui/react'
import React, { useCallback } from 'react'
import {
	CheckboxInputField,
	ColorInputField,
	DropdownInputField,
	MultiDropdownInputField,
	NumberInputField,
	TextInputField,
} from '~/Components/index.js'
import { InternalCustomVariableDropdown, InternalModuleField } from './InternalModuleField.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDollarSign, faGlobe, faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import { InternalActionInputField, InternalFeedbackInputField } from '@companion-app/shared/Model/Options.js'
import classNames from 'classnames'
import { DropdownChoiceInt, ControlLocalVariables, InternalActionLocalVariables } from '~/LocalVariableDefinitions.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { StaticTextFieldText } from './StaticTextField.js'

interface OptionsInputFieldProps {
	connectionId: string
	isLocatedInGrid: boolean
	entityType: EntityModelType | null
	option: InternalActionInputField | InternalFeedbackInputField
	value: any
	setValue: (key: string, value: any) => void
	visibility: boolean
	readonly?: boolean
}

function OptionLabel({
	option,
	features,
}: {
	option: InternalActionInputField | InternalFeedbackInputField
	features?: InputFeatureIconsProps
}) {
	return (
		<>
			{option.label}
			<InputFeatureIcons {...features} />
			{option.tooltip && <FontAwesomeIcon icon={faQuestionCircle} title={option.tooltip} />}
		</>
	)
}

export function OptionsInputField({
	connectionId,
	isLocatedInGrid,
	entityType,
	option,
	value,
	setValue,
	visibility,
	readonly,
}: Readonly<OptionsInputFieldProps>): React.JSX.Element {
	const setValue2 = useCallback((val: any) => setValue(option.id, val), [option.id, setValue])

	if (!option) {
		return <p>Bad option</p>
	}

	const isInternal = connectionId === 'internal'

	let control: JSX.Element | string | undefined = undefined
	let features: InputFeatureIconsProps | undefined = undefined
	switch (option.type) {
		case 'textinput': {
			features = {
				variables: !!option.useVariables,
				local: typeof option.useVariables === 'object' && !!option.useVariables?.local,
			}

			let localVariables: DropdownChoiceInt[] | undefined
			if (features.local) {
				if (isLocatedInGrid) {
					localVariables = ControlLocalVariables
					if (isInternal && entityType === EntityModelType.Action) {
						localVariables = InternalActionLocalVariables
					}
				}
			}

			control = (
				<TextInputField
					value={value}
					regex={option.regex}
					required={option.required}
					placeholder={option.placeholder}
					useVariables={features.variables}
					localVariables={localVariables}
					isExpression={option.isExpression}
					disabled={readonly}
					setValue={setValue2}
				/>
			)
			break
		}
		case 'dropdown': {
			control = (
				<DropdownInputField
					value={value}
					choices={option.choices}
					allowCustom={option.allowCustom}
					minChoicesForSearch={option.minChoicesForSearch}
					regex={option.regex}
					disabled={readonly}
					setValue={setValue2}
				/>
			)
			break
		}
		case 'multidropdown': {
			control = (
				<MultiDropdownInputField
					value={value}
					choices={option.choices}
					allowCustom={option.allowCustom}
					minSelection={option.minSelection}
					minChoicesForSearch={option.minChoicesForSearch}
					maxSelection={option.maxSelection}
					regex={option.regex}
					disabled={readonly}
					setValue={setValue2}
				/>
			)
			break
		}
		case 'checkbox': {
			control = <CheckboxInputField value={value} disabled={readonly} setValue={setValue2} />
			break
		}
		case 'colorpicker': {
			control = (
				<ColorInputField
					value={value}
					disabled={readonly}
					setValue={setValue2}
					enableAlpha={option.enableAlpha ?? false}
					returnType={option.returnType ?? 'number'}
					presetColors={option.presetColors}
				/>
			)
			break
		}
		case 'number': {
			control = (
				<NumberInputField
					value={value}
					required={option.required}
					min={option.min}
					max={option.max}
					step={option.step}
					range={option.range}
					disabled={readonly}
					setValue={setValue2}
				/>
			)
			break
		}
		case 'static-text': {
			control = <StaticTextFieldText {...option} />

			if (option.label) {
				control = (
					<>
						<CFormLabel>
							<OptionLabel option={option} />
						</CFormLabel>
						{control}
					</>
				)
			}
			break
		}
		case 'custom-variable': {
			if (entityType === EntityModelType.Action) {
				control = (
					<InternalCustomVariableDropdown disabled={!!readonly} value={value} setValue={setValue2} includeNone={true} />
				)
			}
			break
		}
		default:
			// The 'internal module' is allowed to use some special input fields, to minimise when it reacts to changes elsewhere in the system
			if (isInternal) {
				control = InternalModuleField(option, isLocatedInGrid, !!readonly, value, setValue2) ?? undefined
			}
			// Use default below
			break
	}

	if (control === undefined) {
		control = <CInputGroupText>Unknown type "{option.type}"</CInputGroupText>
	}

	return (
		<>
			<CFormLabel
				htmlFor="colFormConnection"
				className={classNames('col-sm-4 col-form-label col-form-label-sm', { displayNone: !visibility })}
			>
				<OptionLabel option={option} features={features} />
			</CFormLabel>
			<CCol sm={8} className={classNames({ displayNone: !visibility })}>
				{control}
			</CCol>
		</>
	)
}

export interface InputFeatureIconsProps {
	variables?: boolean
	local?: boolean
}

export function InputFeatureIcons(props: InputFeatureIconsProps): JSX.Element | null {
	const featureIcons: JSX.Element[] = []
	if (props.variables)
		featureIcons.push(<FontAwesomeIcon key="variables" icon={faDollarSign} title={'Supports global variables'} />)
	if (props.local) featureIcons.push(<FontAwesomeIcon key="local" icon={faGlobe} title={'Supports local variables'} />)

	return featureIcons.length ? <span className="feature-icons">{featureIcons}</span> : null
}
