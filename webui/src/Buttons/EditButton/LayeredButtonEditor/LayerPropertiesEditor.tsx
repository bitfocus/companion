import { SomeButtonGraphicsLayer } from '@companion-app/shared/Model/StyleLayersModel.js'
import { CFormTextarea } from '@coreui/react'
import React, { useContext, useCallback, useState } from 'react'
import { RootAppStoreContext } from '../../../Stores/RootAppStore.js'
import { toJS } from 'mobx'
import { observer } from 'mobx-react-lite'

interface LayerPropertiesEditorProps {
	controlId: string
	layerProps: Readonly<SomeButtonGraphicsLayer>
}
export const LayerPropertiesEditor = observer(function LayerPropertiesEditor({
	controlId,
	layerProps,
}: LayerPropertiesEditorProps) {
	const { socket } = useContext(RootAppStoreContext)

	const layerId = layerProps.id
	const updateOptions = useCallback(
		(diff: Record<string, any>) => {
			socket
				.emitPromise('controls:style:update-options', [controlId, layerId, diff])
				.then((res) => {
					console.log('Update layer', res)
				})
				.catch((e) => {
					console.error('Failed to Update layer', e)
				})
		},
		[socket, controlId, layerId]
	)

	const [editingValue, setEditingValue] = useState<string | null>(null)
	const [valueError, setValueError] = useState(false)

	const layerPropsStr = JSON.stringify(toJS(layerProps), null, 2)

	return (
		<div>
			<p>Layer props editor for {layerProps.type}</p>

			<CFormTextarea
				style={{ borderColor: valueError ? 'red' : '', height: '500px' }}
				value={editingValue ?? layerPropsStr}
				onChange={(e) => {
					setEditingValue(e.target.value)
					setValueError(false)
				}}
				onFocus={() => {
					setEditingValue(layerPropsStr)
					setValueError(false)
				}}
				onBlur={() => {
					try {
						const json = JSON.parse(editingValue ?? '')
						updateOptions(json)

						setEditingValue(null)
					} catch (e) {
						setValueError(true)
					}
				}}
			/>
		</div>
	)
})
