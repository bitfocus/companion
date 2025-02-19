import { LayeredButtonModel, SomeButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import { ControlLocation } from '@companion-app/shared/Model/Common.js'
import React, { useEffect, useRef, useState } from 'react'
import { ControlOptionsEditor } from '../../../Controls/ControlOptionsEditor.js'
import { MyErrorBoundary } from '../../../util.js'
import { ButtonEditorExtraTabs, ButtonEditorTabs } from '../ButtonEditorTabs.js'
import { ButtonPreviewBase } from '../../../Components/ButtonPreview.js'
import { AddLayerOfTypeButton } from './Buttons.js'
import { LayerPropertiesEditor } from './LayerPropertiesEditor.js'
import { LayeredStyleStore } from './StyleStore.js'
import { observer } from 'mobx-react-lite'
import { LayerList } from './LayerList.js'
import { NonIdealState } from '../../../Components/NonIdealState.js'
import { faLayerGroup } from '@fortawesome/free-solid-svg-icons'

const LayeredButtonExtraTabs: ButtonEditorExtraTabs[] = [
	{ id: 'style', name: 'Style', position: 'start' },
	{ id: 'options', name: 'Options', position: 'end' },
]

export const LayeredButtonEditor = observer(function LayeredButtonEditor({
	config,
	controlId,
	runtimeProps,
	location,
	previewImage,
}: {
	config: LayeredButtonModel
	controlId: string
	runtimeProps: Record<string, any> | false
	location: ControlLocation
	previewImage: string | null
}) {
	const configRef = useRef<SomeButtonModel>()
	configRef.current = config || undefined // update the ref every render

	const [styleStore] = useState(() => {
		console.log('new store')
		return new LayeredStyleStore()
	})
	useEffect(() => {
		console.log('update data')
		styleStore.updateData(config.style?.layers || [])
	}, [config.style?.layers])

	return (
		<>
			{runtimeProps && (
				<MyErrorBoundary>
					<ButtonEditorTabs
						location={location}
						controlId={controlId}
						steps={config.steps || {}}
						runtimeProps={runtimeProps}
						rotaryActions={config?.options?.rotaryActions}
						extraTabs={LayeredButtonExtraTabs}
					>
						{(currentTab) => {
							if (currentTab === 'style') {
								return (
									<div className="mt-10">
										{/* Wrap the entity-category, for :first-child to work */}
										<MyErrorBoundary>
											<LayeredButtonEditorStyle
												controlId={controlId}
												styleStore={styleStore}
												previewImage={previewImage}
											/>
										</MyErrorBoundary>
									</div>
								)
							}

							if (currentTab === 'options') {
								return (
									<div className="mt-10">
										{/* Wrap the entity-category, for :first-child to work */}
										<MyErrorBoundary>
											<ControlOptionsEditor options={config.options} configRef={configRef} controlId={controlId} />
										</MyErrorBoundary>
									</div>
								)
							}

							return null
						}}
					</ButtonEditorTabs>
				</MyErrorBoundary>
			)}
		</>
	)
})

interface LayeredButtonEditorStyleProps {
	controlId: string
	styleStore: LayeredStyleStore
	previewImage: string | null
}
const LayeredButtonEditorStyle = observer(function LayeredButtonEditorStyle({
	controlId,
	styleStore,
	previewImage,
}: LayeredButtonEditorStyleProps) {
	const layerProps = styleStore.getSelectedLayer()

	return (
		<div className="button-layer-style-editor">
			<div className="button-layer-preview">
				PVW
				<ButtonPreviewBase fixedSize preview={previewImage} />
			</div>
			<div className="button-layer-layerlist">
				<LayerList styleStore={styleStore} controlId={controlId} />

				<hr />

				<AddLayerOfTypeButton controlId={controlId} layerType="text" label="Add text layer" styleStore={styleStore} />
				<AddLayerOfTypeButton controlId={controlId} layerType="image" label="Add image layer" styleStore={styleStore} />
			</div>
			<div className="button-layer-options">
				<hr />

				{layerProps ? (
					<LayerPropertiesEditor controlId={controlId} layerProps={layerProps} />
				) : (
					<NonIdealState icon={faLayerGroup}>Select a layer from the list above to edit its properties</NonIdealState>
				)}
			</div>
		</div>
	)
})
