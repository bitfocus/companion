import { ButtonGraphicsLineElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { observer } from 'mobx-react-lite'
import React from 'react'
import { FormPropertyField, InputFieldCommonProps } from './ElementPropertiesUtil.js'
import { NumberInputField } from '~/Components/NumberInputField.js'
import { BorderPropertiesEditor } from './BorderPropertiesEditor.js'

export const LineElementPropertiesEditor = observer(function LineElementPropertiesEditor({
	elementProps,
}: {
	elementProps: Readonly<ButtonGraphicsLineElement>
}) {
	return (
		<>
			<FormPropertyField elementProps={elementProps} property="fromX" label="From X">
				{(elementProp, setValue) => <FieldFromXInput elementProp={elementProp} setValue={setValue} />}
			</FormPropertyField>

			<FormPropertyField elementProps={elementProps} property="fromY" label="From Y">
				{(elementProp, setValue) => <FieldFromYInput elementProp={elementProp} setValue={setValue} />}
			</FormPropertyField>

			<FormPropertyField elementProps={elementProps} property="toX" label="To X">
				{(elementProp, setValue) => <FieldToXInput elementProp={elementProp} setValue={setValue} />}
			</FormPropertyField>

			<FormPropertyField elementProps={elementProps} property="toY" label="To Y">
				{(elementProp, setValue) => <FieldToYInput elementProp={elementProp} setValue={setValue} />}
			</FormPropertyField>

			<BorderPropertiesEditor elementProps={elementProps} borderName="Line" />
		</>
	)
})

const FieldFromXInput = observer(function FieldFromXInput({
	elementProp,
	setValue,
}: InputFieldCommonProps<ButtonGraphicsLineElement, 'fromX'>) {
	return <NumberInputField setValue={setValue} value={Number(elementProp.value)} min={0} max={100} step={1} />
})

const FieldFromYInput = observer(function FieldFromYInput({
	elementProp,
	setValue,
}: InputFieldCommonProps<ButtonGraphicsLineElement, 'fromY'>) {
	return <NumberInputField setValue={setValue} value={Number(elementProp.value)} min={0} max={100} step={1} />
})

const FieldToXInput = observer(function FieldToXInput({
	elementProp,
	setValue,
}: InputFieldCommonProps<ButtonGraphicsLineElement, 'toX'>) {
	return <NumberInputField setValue={setValue} value={Number(elementProp.value)} min={0} max={100} step={1} />
})

const FieldToYInput = observer(function FieldToYInput({
	elementProp,
	setValue,
}: InputFieldCommonProps<ButtonGraphicsLineElement, 'toY'>) {
	return <NumberInputField setValue={setValue} value={Number(elementProp.value)} min={0} max={100} step={1} />
})
