import { CFormLabel, CCol } from '@coreui/react'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import React from 'react'
import { ButtonGraphicsElementBase } from '@companion-app/shared/Model/StyleLayersModel.js'
import { useElementMutatorCallback } from './StyleStore.js'
import { TextInputField } from '../../../Components/TextInputField.js'

export const ElementCommonProperties = observer(function ElementCommonProperties({
	controlId,
	elementProps,
}: {
	controlId: string
	elementProps: Readonly<ButtonGraphicsElementBase>
}) {
	return (
		<>
			<CFormLabel htmlFor="inputName" className={classNames('col-sm-4 col-form-label col-form-label-sm')}>
				Element Name
			</CFormLabel>
			<CCol sm={8}>
				<FieldElementNameInput controlId={controlId} elementProps={elementProps} />
			</CCol>
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
	const setName = useElementMutatorCallback<ButtonGraphicsElementBase, 'name'>(controlId, elementProps.id, 'name')

	return <TextInputField setValue={setName} value={elementProps.name ?? ''} />
})
