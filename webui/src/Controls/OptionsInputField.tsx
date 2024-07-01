import { CFormGroup, CInputGroupText, CLabel } from '@coreui/react'
import React, { useCallback } from 'react'
import {
	CheckboxInputField,
	ColorInputField,
	DropdownInputField,
	NumberInputField,
	TextInputField,
} from '../Components/index.js'
import { InternalCustomVariableDropdown, InternalInstanceField } from './InternalInstanceFields.jsx'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDollarSign, faGlobe, faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import { InternalActionInputField, InternalFeedbackInputField } from '@companion-app/shared/Model/Options.js'
import classNames from 'classnames'
import sanitizeHtml from 'sanitize-html'

interface OptionsInputFieldProps {
	connectionId: string
	isOnControl: boolean
	isAction: boolean
	option: InternalActionInputField | InternalFeedbackInputField
	value: any
	setValue: (key: string, value: any) => void
	visibility: boolean
	readonly?: boolean
}

export function OptionsInputField({
	connectionId,
	isOnControl,
	isAction,
	option,
	value,
	setValue,
	visibility,
	readonly,
}: Readonly<OptionsInputFieldProps>) {
	const setValue2 = useCallback((val: any) => setValue(option.id, val), [option.id, setValue])

	if (!option) {
		return <p>Bad option</p>
	}

	let control: JSX.Element | string | undefined = undefined
	let showLabel = true
	let features: InputFeatureIconsProps = {}
	switch (option.type) {
		case 'textinput': {
			features.variables = !!option.useVariables
			features.local = typeof option.useVariables === 'object' && !!option.useVariables?.local

			control = (
				<TextInputField
					value={value}
					regex={option.regex}
					required={option.required}
					placeholder={option.placeholder}
					useVariables={features.variables}
					useLocalVariables={features.local}
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
					multiple={false}
					setValue={setValue2}
				/>
			)
			break
		}
		case 'multidropdown': {
			control = (
				<DropdownInputField
					value={value}
					choices={option.choices}
					allowCustom={option.allowCustom}
					minSelection={option.minSelection}
					minChoicesForSearch={option.minChoicesForSearch}
					maxSelection={option.maxSelection}
					regex={option.regex}
					disabled={readonly}
					multiple={true}
					setValue={setValue2}
				/>
			)
			break
		}
		case 'checkbox': {
			control = (
				<p>
					<CheckboxInputField value={value} disabled={readonly} setValue={setValue2} />
					&nbsp;
				</p>
			)
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
			showLabel = !!option.label

			control = ''
			if (option.value && option.value != option.label) {
				const descriptionHtml = {
					__html: sanitizeHtml(option.value ?? '', {
						allowedTags: sanitizeHtml.defaults.allowedTags.concat([]),
						disallowedTagsMode: 'escape',
					}),
				}

				control = <p title={option.tooltip} dangerouslySetInnerHTML={descriptionHtml}></p>
			}
			break
		}
		case 'custom-variable': {
			if (isAction) {
				control = (
					<InternalCustomVariableDropdown disabled={!!readonly} value={value} setValue={setValue2} includeNone={true} />
				)
			}
			break
		}
		default:
			// The 'internal instance' is allowed to use some special input fields, to minimise when it reacts to changes elsewhere in the system
			if (connectionId === 'internal') {
				control = InternalInstanceField(option, isOnControl, !!readonly, value, setValue2) ?? undefined
			}
			// Use default below
			break
	}

	if (control === undefined) {
		control = <CInputGroupText>Unknown type "{option.type}"</CInputGroupText>
	}

	return (
		<CFormGroup className={classNames({ displayNone: !visibility })}>
			{showLabel && (
				<CLabel>
					{option.label}
					<InputFeatureIcons {...features} />
					{option.tooltip && <FontAwesomeIcon icon={faQuestionCircle} title={option.tooltip} />}
				</CLabel>
			)}
			{control}
		</CFormGroup>
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
