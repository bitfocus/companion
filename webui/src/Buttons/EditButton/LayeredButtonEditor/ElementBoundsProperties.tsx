import { observer } from 'mobx-react-lite'
import React from 'react'
import {
	ButtonGraphicsDrawBounds,
	ButtonGraphicsElementBase,
	MakeExpressionable,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import { FormPropertyField, InputFieldCommonProps } from './ElementPropertiesUtil.js'
import { NumberInputField } from '../../../Components/NumberInputField.js'

type ButtonGraphicsDrawBoundsExt = MakeExpressionable<ButtonGraphicsDrawBounds & { type: string }> &
	ButtonGraphicsElementBase

export const ElementBoundsProperties = observer(function ElementBoundsProperties({
	controlId,
	elementProps,
}: {
	controlId: string
	elementProps: Readonly<ButtonGraphicsDrawBoundsExt>
}) {
	return (
		<>
			<FormPropertyField controlId={controlId} elementProps={elementProps} property="x" label="X">
				{(elementProp, setValue) => <FieldX elementProp={elementProp} setValue={setValue} />}
			</FormPropertyField>

			<FormPropertyField controlId={controlId} elementProps={elementProps} property="y" label="Y">
				{(elementProp, setValue) => <FieldY elementProp={elementProp} setValue={setValue} />}
			</FormPropertyField>

			<FormPropertyField controlId={controlId} elementProps={elementProps} property="width" label="Width">
				{(elementProp, setValue) => <FieldWidth elementProp={elementProp} setValue={setValue} />}
			</FormPropertyField>

			<FormPropertyField controlId={controlId} elementProps={elementProps} property="height" label="Height">
				{(elementProp, setValue) => <FieldHeight elementProp={elementProp} setValue={setValue} />}
			</FormPropertyField>
		</>
	)
})

const FieldX = observer(function FieldX({
	elementProp,
	setValue,
}: InputFieldCommonProps<ButtonGraphicsDrawBoundsExt, 'x'>) {
	return <NumberInputField setValue={setValue} value={Number(elementProp.value)} step={0.01} />
})

const FieldY = observer(function FieldX({
	elementProp,
	setValue,
}: InputFieldCommonProps<ButtonGraphicsDrawBoundsExt, 'y'>) {
	return <NumberInputField setValue={setValue} value={Number(elementProp.value)} step={0.01} />
})

const FieldWidth = observer(function FieldX({
	elementProp,
	setValue,
}: InputFieldCommonProps<ButtonGraphicsDrawBoundsExt, 'width'>) {
	return <NumberInputField setValue={setValue} value={Number(elementProp.value)} step={0.01} />
})

const FieldHeight = observer(function FieldX({
	elementProp,
	setValue,
}: InputFieldCommonProps<ButtonGraphicsDrawBoundsExt, 'height'>) {
	return <NumberInputField setValue={setValue} value={Number(elementProp.value)} step={0.01} />
})
