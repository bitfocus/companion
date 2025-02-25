import { CFormLabel, CCol } from '@coreui/react'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import React, { useCallback, useContext } from 'react'
import {
	ButtonGraphicsElementBase,
	ButtonGraphicsTextElement,
	SomeButtonGraphicsElement,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import { TextInputField } from '../../../Components/TextInputField.js'
import { RootAppStoreContext } from '../../../Stores/RootAppStore.js'
import { FormPropertyField, InputFieldCommonProps } from './ElementPropertiesUtil.js'
import { CheckboxInputField } from '../../../Components/CheckboxInputField.js'

export const ElementCommonProperties = observer(function ElementCommonProperties({
	controlId,
	elementProps,
}: {
	controlId: string
	elementProps: Readonly<SomeButtonGraphicsElement>
}) {
	return (
		<>
			<CFormLabel htmlFor="inputName" className={classNames('col-sm-4 col-form-label col-form-label-sm')}>
				Element Name
			</CFormLabel>
			<CCol sm={8}>
				<FieldElementNameInput controlId={controlId} elementProps={elementProps} />
			</CCol>

			{elementProps.type !== 'canvas' && (
				<FormPropertyField controlId={controlId} elementProps={elementProps} property="enabled" label="Enabled">
					{(elementProp, setValue) => <FieldEnabledInput elementProp={elementProp} setValue={setValue} />}
				</FormPropertyField>
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

const FieldEnabledInput = observer(function FieldEnabledInput({
	elementProp,
	setValue,
}: InputFieldCommonProps<ButtonGraphicsTextElement, 'enabled'>) {
	return <CheckboxInputField setValue={setValue} value={Boolean(elementProp.value)} />
})
