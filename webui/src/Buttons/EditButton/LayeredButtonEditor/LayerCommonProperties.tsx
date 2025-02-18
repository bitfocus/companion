import { CFormLabel, CCol } from '@coreui/react'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import React from 'react'
import { ButtonGraphicsLayerBase } from '@companion-app/shared/Model/StyleLayersModel.js'
import { useLayerMutatorCallback } from './StyleStore.js'
import { TextInputField } from '../../../Components/TextInputField.js'

export const LayerCommonProperties = observer(function LayerCommonProperties({
	controlId,
	layerProps,
}: {
	controlId: string
	layerProps: Readonly<ButtonGraphicsLayerBase>
}) {
	return (
		<>
			<CFormLabel htmlFor="inputName" className={classNames('col-sm-4 col-form-label col-form-label-sm')}>
				Layer Name
			</CFormLabel>
			<CCol sm={8}>
				<FieldLayerNameInput controlId={controlId} layerProps={layerProps} />
			</CCol>
		</>
	)
})

const FieldLayerNameInput = observer(function FieldLayerNameInput({
	controlId,
	layerProps,
}: {
	controlId: string
	layerProps: ButtonGraphicsLayerBase
}) {
	const setName = useLayerMutatorCallback<ButtonGraphicsLayerBase, 'name'>(controlId, layerProps.id, 'name')

	return <TextInputField setValue={setName} value={layerProps.name ?? ''} />
})
