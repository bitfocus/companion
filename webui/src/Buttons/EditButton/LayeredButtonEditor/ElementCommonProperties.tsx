import { CFormLabel, CCol } from '@coreui/react'
import { observer } from 'mobx-react-lite'
import React, { useCallback, useContext } from 'react'
import {
	ButtonGraphicsElementBase,
	ButtonGraphicsElementUsage,
	ButtonGraphicsTextElement,
	SomeButtonGraphicsElement,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import { TextInputField } from '../../../Components/TextInputField.js'
import { RootAppStoreContext } from '../../../Stores/RootAppStore.js'
import { FormPropertyField, InputFieldCommonProps } from './ElementPropertiesUtil.js'
import { CheckboxInputField } from '../../../Components/CheckboxInputField.js'
import { LocalVariablesStore } from '../../../Controls/LocalVariablesStore.js'
import { NumberInputField } from '../../../Components/NumberInputField.js'
import { DropdownInputField } from '../../../Components/DropdownInputField.js'
import type { DropdownChoice, DropdownChoiceId } from '@companion-module/base'
import { InlineHelp } from '../../../Components/InlineHelp.js'

export const ElementCommonProperties = observer(function ElementCommonProperties({
	controlId,
	elementProps,
	localVariablesStore,
}: {
	controlId: string
	elementProps: Readonly<SomeButtonGraphicsElement>
	localVariablesStore: LocalVariablesStore
}) {
	return (
		<>
			<CFormLabel htmlFor="inputName" className="col-sm-4 col-form-label col-form-label-sm">
				Element Name
			</CFormLabel>
			<CCol sm={8}>
				<FieldElementNameInput controlId={controlId} elementProps={elementProps} />
			</CCol>

			{elementProps.type !== 'canvas' && (
				<>
					<CFormLabel htmlFor="inputUsage" className="col-sm-4 col-form-label col-form-label-sm">
						<InlineHelp help="Some surfaces do not have full rgb displays and so require specific elements for providing feedback in alternate ways. You can override the automatic selection of layers for these purposes by selecting the appropriate usage for this element.">
							Usage
						</InlineHelp>
					</CFormLabel>
					<CCol sm={8}>
						<FieldElementUsageInput controlId={controlId} elementProps={elementProps} />
					</CCol>

					<FormPropertyField
						controlId={controlId}
						elementProps={elementProps}
						localVariablesStore={localVariablesStore}
						property="enabled"
						label="Enabled"
					>
						{(elementProp, setValue) => <FieldEnabledInput elementProp={elementProp} setValue={setValue} />}
					</FormPropertyField>

					<FormPropertyField
						controlId={controlId}
						elementProps={elementProps}
						localVariablesStore={localVariablesStore}
						property="opacity"
						label="Opacity"
					>
						{(elementProp, setValue) => <FieldOpacityInput elementProp={elementProp} setValue={setValue} />}
					</FormPropertyField>
				</>
			)}
		</>
	)
})

const FieldElementNameInput = observer(function FieldElementNameInput({
	controlId,
	elementProps,
}: {
	controlId: string
	elementProps: ButtonGraphicsElementBase
}) {
	const { socket } = useContext(RootAppStoreContext)

	const setName = useCallback(
		(value: string) => {
			socket
				.emitPromise('controls:style:set-element-name', [controlId, elementProps.id, value])
				.then((res) => {
					console.log('Update element', res)
				})
				.catch((e) => {
					console.error('Failed to Update element', e)
				})
		},
		[socket, controlId, elementProps.id]
	)

	return <TextInputField setValue={setName} value={elementProps.name ?? ''} />
})

const FieldElementUsageInput = observer(function FieldElementUsageInput({
	controlId,
	elementProps,
}: {
	controlId: string
	elementProps: ButtonGraphicsElementBase
}) {
	const { socket } = useContext(RootAppStoreContext)

	const setUsage = useCallback(
		(value: DropdownChoiceId) => {
			socket
				.emitPromise('controls:style:set-element-usage', [
					controlId,
					elementProps.id,
					value as ButtonGraphicsElementUsage,
				])
				.then((res) => {
					console.log('Update element', res)
				})
				.catch((e) => {
					console.error('Failed to Update element', e)
				})
		},
		[socket, controlId, elementProps.id]
	)

	// TODO: Should ths choices be dynamic based on the element type?
	return (
		<DropdownInputField
			setValue={setUsage}
			value={elementProps.usage as DropdownChoiceId}
			choices={elementUsageChoices}
		/>
	)
})

const elementUsageChoices: DropdownChoice[] = [
	{ id: ButtonGraphicsElementUsage.Automatic, label: 'Automatic' },
	{ id: ButtonGraphicsElementUsage.Text, label: 'Text' },
	{ id: ButtonGraphicsElementUsage.Color, label: 'Color' },
]

const FieldEnabledInput = observer(function FieldEnabledInput({
	elementProp,
	setValue,
}: InputFieldCommonProps<ButtonGraphicsTextElement, 'enabled'>) {
	return <CheckboxInputField setValue={setValue} value={Boolean(elementProp.value)} />
})

const FieldOpacityInput = observer(function FieldOpacityInput({
	elementProp,
	setValue,
}: InputFieldCommonProps<ButtonGraphicsTextElement, 'opacity'>) {
	return <NumberInputField setValue={setValue} value={Number(elementProp.value)} min={0} max={100} step={1} range />
})
