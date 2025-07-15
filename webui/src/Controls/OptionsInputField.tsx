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
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { StaticTextFieldText } from './StaticTextField.js'
import { LocalVariablesStore } from './LocalVariablesStore.js'
import { observer } from 'mobx-react-lite'
import { validateInputValue } from '~/Helpers/validateInputValue.js'

interface OptionsInputFieldProps {
	connectionId: string
	isLocatedInGrid: boolean
	entityType: EntityModelType | null
	option: InternalActionInputField | InternalFeedbackInputField
	value: any
	setValue: (key: string, value: any) => void
	visibility: boolean
	readonly?: boolean
	localVariablesStore: LocalVariablesStore | null
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

export const OptionsInputField = observer(function OptionsInputField({
	connectionId,
	isLocatedInGrid,
	entityType,
	option,
	value,
	setValue,
	visibility,
	readonly,
	localVariablesStore,
}: Readonly<OptionsInputFieldProps>): React.JSX.Element {
	const checkValid = useCallback((value: any) => validateInputValue(option, value) === undefined, [option])
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

			const localVariables = features.local
				? localVariablesStore?.getOptions(entityType, isInternal, isLocatedInGrid)
				: undefined

			control = (
				<TextInputField
					value={value}
					placeholder={option.placeholder}
					useVariables={features.variables}
					localVariables={localVariables}
					isExpression={option.isExpression}
					disabled={readonly}
					setValue={setValue2}
					checkValid={checkValid}
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
					checkValid={checkValid}
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
					checkValid={checkValid}
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
					min={option.min}
					max={option.max}
					step={option.step}
					range={option.range}
					disabled={readonly}
					setValue={setValue2}
					checkValid={checkValid}
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
})

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
