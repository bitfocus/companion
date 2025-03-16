import { ButtonGraphicsGroupElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { observer } from 'mobx-react-lite'
import React from 'react'
import { LocalVariablesStore } from '../../../Controls/LocalVariablesStore.js'

export const GroupElementPropertiesEditor = observer(function GroupElementPropertiesEditor(
	{
		// controlId,
		// elementProps,
		// localVariablesStore,
	}: {
		controlId: string
		elementProps: Readonly<ButtonGraphicsGroupElement>
		localVariablesStore: LocalVariablesStore
	}
) {
	return <>{/* Nothing yet */}</>
})
