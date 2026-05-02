import { CFormSwitch } from '@coreui/react'
import { faLayerGroup } from '@fortawesome/free-solid-svg-icons'
import { observer } from 'mobx-react-lite'
import { useMemo, useRef, useState } from 'react'
import { useLocalStorage } from 'usehooks-ts'
import type { LayeredButtonModel, SomeButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { LayeredStyleElementsProvider } from '~/Controls/Components/LayeredStyleElementsContext.js'
import { useLocalVariablesStore, type LocalVariablesStore } from '~/Controls/LocalVariablesStore.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { LocalVariablesEditor } from '../../../Controls/LocalVariablesEditor.js'
import { ButtonEditorTabs, type ButtonEditorExtraTabs } from '../ButtonEditorTabs.js'
import { FeedbackOverridesTab } from '../FeedbackOverridesTab.js'
import { ControlOptionsEditor } from './ControlOptionsEditor.js'
import { ElementPropertiesEditor } from './ElementPropertiesEditor.js'
import { ElementsList } from './ElementsList.js'
import { LayeredButtonPreviewRenderer } from './Preview/LayeredButtonPreviewRenderer.js'
import { LayeredStyleStore } from './StyleStore.js'

const LayeredButtonExtraTabs: ButtonEditorExtraTabs[] = [
	{ id: 'style', name: 'Style', position: 'end' },
	{ id: 'feedbacks', name: 'Feedbacks', position: 'end' },
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
	useMemo(() => {
		console.log('update data')
		styleStore.updateData(config.style?.layers || [])
	}, [styleStore, config.style?.layers])
	useMemo(() => {
		console.log('update overrides')
		styleStore.updateOverridesData(config.feedbacks || [])
	}, [styleStore, config.feedbacks])

	const localVariablesStore = useLocalVariablesStore(controlId, config.localVariables)

	return (
		<div
			className="grow flex flex-column"
			style={{
				marginTop: '50px', // HACK: this is a bit silly, but is needed to avoid clipping the preview
				// Once we have a 'notes' section, that can occupy the space this creates and avoid this issue for us.
			}}
		>
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
						disabledSetStep={config?.options?.stepProgression === 'expression'}
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

							if (currentTab === 'feedbacks') {
								return (
									<div className="mt-10">
										<MyErrorBoundary>
											<LayeredStyleElementsProvider styleStore={styleStore}>
												<FeedbackOverridesTab
													controlId={controlId}
													location={location}
													feedbacks={config.feedbacks}
													localVariablesStore={localVariablesStore}
												/>
											</LayeredStyleElementsProvider>
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
	const [simpleMode, setSimpleMode] = useLocalStorage('layeredEditor.simpleMode', true)

	return (
		<div className="button-layer-style-editor h-100">
			<div className="button-layer-top">
				<div className="button-layer-preview">
					<LayeredButtonPreviewRenderer controlId={controlId} location={location} styleStore={styleStore} />
				</div>
				<div className="button-layer-elementlist">
					<ElementsList styleStore={styleStore} controlId={controlId} />
				</div>
				<div className="button-layer-simple">
					<CFormSwitch
						className="text-muted"
						label="Simple"
						checked={simpleMode}
						onChange={(e) => setSimpleMode(e.target.checked)}
						title={simpleMode ? 'Showing a reduced set of properties' : 'Showing the full set of properties'}
					/>
				</div>
				<hr />
			</div>
			<div className="button-layer-options">
				{elementProps ? (
					<ElementPropertiesEditor
						controlId={controlId}
						elementProps={elementProps}
						localVariablesStore={localVariablesStore}
						isPropertyOverridden={styleStore.isPropertyOverridden}
						simpleMode={simpleMode}
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
