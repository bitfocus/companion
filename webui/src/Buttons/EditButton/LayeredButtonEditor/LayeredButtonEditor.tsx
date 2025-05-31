import { LayeredButtonModel, SomeButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import { ControlLocation } from '@companion-app/shared/Model/Common.js'
import React, { useEffect, useRef, useState } from 'react'
import { ControlOptionsEditor } from './ControlOptionsEditor.js'
import { MyErrorBoundary } from '../../../util.js'
import { ButtonEditorExtraTabs, ButtonEditorTabs } from '../ButtonEditorTabs.js'
import { ElementPropertiesEditor } from './ElementPropertiesEditor.js'
import { LayeredStyleStore } from './StyleStore.js'
import { observer } from 'mobx-react-lite'
import { ElementsList } from './ElementsList.js'
import { NonIdealState } from '../../../Components/NonIdealState.js'
import { faLayerGroup } from '@fortawesome/free-solid-svg-icons'
import { LayeredButtonPreviewRenderer } from './Preview/LayeredButtonPreviewRenderer.js'
import { LocalVariablesEditor } from '../LocalVariablesEditor.js'
import { LocalVariablesStore, useLocalVariablesStore } from '../../../Controls/LocalVariablesStore.js'

const LayeredButtonExtraTabs: ButtonEditorExtraTabs[] = [
	{ id: 'style', name: 'Style', position: 'start' },
	{ id: 'variables', name: 'Local Variables', position: 'end' },
	{ id: 'options', name: 'Options', position: 'end' },
]

export const LayeredButtonEditor = observer(function LayeredButtonEditor({
	config,
	controlId,
	runtimeProps,
	location,
}: {
	config: LayeredButtonModel
	controlId: string
	runtimeProps: Record<string, any> | false
	location: ControlLocation
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

	const localVariablesStore = useLocalVariablesStore(controlId, config.localVariables)

	return (
		<div className="mt-4 grow flex flex-column">
			{runtimeProps && (
				<MyErrorBoundary>
					<ButtonEditorTabs
						location={location}
						controlId={controlId}
						steps={config.steps || {}}
						runtimeProps={runtimeProps}
						rotaryActions={config?.options?.rotaryActions}
						extraTabs={LayeredButtonExtraTabs}
						localVariablesStore={localVariablesStore}
					>
						{(currentTab) => {
							if (currentTab === 'style') {
								return (
									<div className="mt-10 h-100">
										{/* Wrap the entity-category, for :first-child to work */}
										<MyErrorBoundary>
											<LayeredButtonEditorStyle
												controlId={controlId}
												location={location}
												styleStore={styleStore}
												localVariablesStore={localVariablesStore}
											/>
										</MyErrorBoundary>
									</div>
								)
							}

							if (currentTab === 'variables') {
								return (
									<div className="mt-10">
										<MyErrorBoundary>
											<LocalVariablesEditor
												controlId={controlId}
												location={location}
												variables={config.localVariables}
												localVariablesStore={localVariablesStore}
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
		</div>
	)
})

interface LayeredButtonEditorStyleProps {
	controlId: string
	location: ControlLocation
	styleStore: LayeredStyleStore
	// previewImage: string | null
	localVariablesStore: LocalVariablesStore
}
const LayeredButtonEditorStyle = observer(function LayeredButtonEditorStyle({
	controlId,
	location,
	styleStore,
	localVariablesStore,
}: LayeredButtonEditorStyleProps) {
	const elementProps = styleStore.getSelectedElement()

	return (
		<div className="button-layer-style-editor h-100">
			<div className="button-layer-preview">
				{/* <ButtonPreviewBase fixedSize preview={previewImage} /> */}
				<LayeredButtonPreviewRenderer controlId={controlId} location={location} styleStore={styleStore} />
			</div>
			<div className="button-layer-elementlist">
				<ElementsList styleStore={styleStore} controlId={controlId} />
			</div>
			<div className="button-layer-options">
				<hr />

				{elementProps ? (
					<ElementPropertiesEditor
						controlId={controlId}
						elementProps={elementProps}
						localVariablesStore={localVariablesStore}
					/>
				) : (
					<NonIdealState icon={faLayerGroup}>
						Select an element from the list above to edit its properties
					</NonIdealState>
				)}
			</div>
		</div>
	)
})
