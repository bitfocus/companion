import { ButtonGraphicsGroupElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { observer } from 'mobx-react-lite'
import React from 'react'
import { LocalVariablesStore } from '~/Controls/LocalVariablesStore.js'
import { ElementBoundsProperties } from './ElementBoundsProperties.js'

export const GroupElementPropertiesEditor = observer(function GroupElementPropertiesEditor({
	controlId,
	elementProps,
	localVariablesStore,
}: {
	controlId: string
	elementProps: Readonly<ButtonGraphicsGroupElement>
	localVariablesStore: LocalVariablesStore
}) {
	return (
		<>
			<ElementBoundsProperties
				controlId={controlId}
				elementProps={elementProps}
				localVariablesStore={localVariablesStore}
			/>
		</>
	)
})
