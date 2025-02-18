import { LayeredButtonModel, SomeButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import { ControlLocation } from '@companion-app/shared/Model/Common.js'
import React, { useCallback, useContext, useRef, useState } from 'react'
import { ControlOptionsEditor } from '../../Controls/ControlOptionsEditor.js'
import { MyErrorBoundary } from '../../util.js'
import { ButtonEditorExtraTabs, ButtonEditorTabs } from './ButtonEditorTabs.js'
import { ButtonPreviewBase } from '../../Components/ButtonPreview.js'
import { SomeButtonGraphicsLayer } from '@companion-app/shared/Model/StyleLayersModel.js'
import { CButton, CFormTextarea } from '@coreui/react'
import { RootAppStoreContext } from '../../Stores/RootAppStore.js'

const LayeredButtonExtraTabs: ButtonEditorExtraTabs[] = [
	{ id: 'style', name: 'Style', position: 'start' },
	{ id: 'options', name: 'Options', position: 'end' },
]

export function LayeredButtonEditor({
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
												style={config.style}
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
}

interface LayeredButtonEditorStyleProps {
	controlId: string
	style: LayeredButtonModel['style']
	previewImage: string | null
}
function LayeredButtonEditorStyle({ controlId, style, previewImage }: LayeredButtonEditorStyleProps) {
	const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)

	const layerProps = style.layers.find((layer) => layer.id === selectedLayerId)

	return (
		<div className="button-layer-style-editor">
			<div className="button-layer-preview">
				PVW
				<ButtonPreviewBase fixedSize preview={previewImage} />
			</div>
			<div className="button-layer-layerlist">
				<p>Layerlist</p>
				<ul>
					{style.layers.map((layer) => (
						<li key={layer.id}>
							<span
								style={{
									color: selectedLayerId === layer.id ? 'red' : '',
								}}
								onClick={() => setSelectedLayerId(layer.id)}
							>
								{layer.type} ({layer.id})
							</span>{' '}
							<RemoveLayerButton controlId={controlId} layerId={layer.id} />
						</li>
					))}
				</ul>
				<hr />
				<AddLayerOfTypeButton controlId={controlId} layerType="text" label="Add text layer" />
				<AddLayerOfTypeButton controlId={controlId} layerType="image" label="Add image layer" />
			</div>
			<div className="button-layer-options">
				<hr />
				<p>Style goes here! ({controlId})</p>
				<p>Selected: {selectedLayerId}</p>

				{layerProps && <LayerPropsEditor controlId={controlId} layerProps={layerProps} />}
			</div>
		</div>
	)
}

function AddLayerOfTypeButton({
	controlId,
	layerType,
	label,
}: {
	controlId: string
	layerType: string
	label: string
}) {
	const { socket } = useContext(RootAppStoreContext)

	const addLayer = useCallback(() => {
		socket
			.emitPromise('controls:style:add-layer', [controlId, layerType, null])
			.then((res) => {
				console.log('Added layer', res)
			})
			.catch((e) => {
				console.error('Failed to add layer', e)
			})
	}, [socket, controlId, layerType])

	return (
		<CButton color="primary" onClick={addLayer}>
			{label}
		</CButton>
	)
}

function RemoveLayerButton({ controlId, layerId }: { controlId: string; layerId: string }) {
	const { socket } = useContext(RootAppStoreContext)

	const addLayer = useCallback(() => {
		socket
			.emitPromise('controls:style:remove-layer', [controlId, layerId])
			.then((res) => {
				console.log('Remove layer', res)
			})
			.catch((e) => {
				console.error('Failed to remove layer', e)
			})
	}, [socket, controlId, layerId])

	return (
		<CButton color="danger" onClick={addLayer}>
			Remove
		</CButton>
	)
}

interface LayerPropsEditorProps {
	controlId: string
	layerProps: SomeButtonGraphicsLayer
}
function LayerPropsEditor({ controlId, layerProps }: LayerPropsEditorProps) {
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

	const layerPropsStr = JSON.stringify(layerProps, null, 2)

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
}
