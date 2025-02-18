import { SomeButtonGraphicsLayer } from '@companion-app/shared/Model/StyleLayersModel.js'
import React from 'react'
import { observer } from 'mobx-react-lite'
import { assertNever, PreventDefaultHandler } from '../../../util.js'
import { TextLayerPropertiesEditor } from './TextLayerPropertiesEditor.js'
import { CanvasLayerPropertiesEditor } from './CanvasLayerPropertiesEditor.js'
import { ImageLayerPropertiesEditor } from './ImageLayerPropertiesEditor.js'
import { CForm } from '@coreui/react'
import { LayerCommonProperties } from './LayerCommonProperties.js'

interface LayerPropertiesEditorProps {
	controlId: string
	layerProps: Readonly<SomeButtonGraphicsLayer>
}
export const LayerPropertiesEditor = observer(function LayerPropertiesEditor({
	controlId,
	layerProps,
}: LayerPropertiesEditorProps) {
	return (
		<CForm className="row g-2" onSubmit={PreventDefaultHandler}>
			<LayerCommonProperties controlId={controlId} layerProps={layerProps} />

			<LayerPropertiesEditorInner controlId={controlId} layerProps={layerProps} />
		</CForm>
	)
})

const LayerPropertiesEditorInner = observer(function LayerPropertiesEditorInner({
	controlId,
	layerProps,
}: LayerPropertiesEditorProps) {
	switch (layerProps.type) {
		case 'image':
			return <ImageLayerPropertiesEditor controlId={controlId} layerProps={layerProps} />
		case 'text':
			return <TextLayerPropertiesEditor controlId={controlId} layerProps={layerProps} />
		case 'canvas':
			return <CanvasLayerPropertiesEditor controlId={controlId} layerProps={layerProps} />
		default:
			assertNever(layerProps)
			return <div>Unsupported layer type!</div>
	}
})
