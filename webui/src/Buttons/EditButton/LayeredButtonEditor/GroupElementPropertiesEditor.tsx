import { ButtonGraphicsGroupElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { observer } from 'mobx-react-lite'
import React from 'react'
import { ElementBoundsProperties } from './ElementBoundsProperties.js'

export const GroupElementPropertiesEditor = observer(function GroupElementPropertiesEditor({
	elementProps,
}: {
	elementProps: Readonly<ButtonGraphicsGroupElement>
}) {
	return (
		<>
			<ElementBoundsProperties elementProps={elementProps} />
		</>
	)
})
