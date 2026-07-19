import { faLayerGroup } from '@fortawesome/free-solid-svg-icons'
import { observer } from 'mobx-react-lite'
import { useCallback, useMemo, useRef, useState } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { useLocalStorage } from 'usehooks-ts'
import type { LayeredButtonModel, SomeButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { SwitchInputFieldWithLabel } from '~/Components/SwitchInputField.js'
import { LayeredStyleElementsProvider } from '~/Controls/Components/LayeredStyleElementsContext.js'
import { useLocalVariablesStore, type LocalVariablesStore } from '~/Controls/LocalVariablesStore.js'
import { safeSetLocalStorage } from '~/Helpers/SafeStorage.js'
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

	const localVariablesStore = useLocalVariablesStore(controlId, config.localVariables, location.pageNumber)

	return (
		<div className="grow flex flex-column min-h-0">
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
	const savedPanelLayout = useMemo(() => {
		try {
			return JSON.parse(localStorage.getItem('layeredEditor.panelSizes') ?? '') ?? undefined
		} catch {
			return undefined
		}
	}, [])
	const savePanelLayout = useCallback(
		// Note: This can't use useLocalStorage because it fires during the mount of the Group causing a react error
		(layout: Record<string, number>) => safeSetLocalStorage('layeredEditor.panelSizes', JSON.stringify(layout)),
		[]
	)

	return (
		<Group
			orientation="vertical"
			className="button-layer-style-editor h-100"
			defaultLayout={savedPanelLayout}
			onLayoutChanged={savePanelLayout}
		>
			<Panel id="top" className="button-layer-top" defaultSize="30vh" minSize="200px">
				<div className="button-layer-preview">
					<LayeredButtonPreviewRenderer controlId={controlId} location={location} styleStore={styleStore} />
				</div>
				<div className="button-layer-elementlist">
					<ElementsList styleStore={styleStore} controlId={controlId} />
				</div>
				<div className="button-layer-simple">
					<SwitchInputFieldWithLabel
						className="text-muted"
						label="Simple"
						value={simpleMode}
						setValue={setSimpleMode}
						tooltip={simpleMode ? 'Showing a reduced set of properties' : 'Showing the full set of properties'}
						small
					/>
				</div>
			</Panel>
			<Separator className="button-layer-resize-handle" />
			<Panel id="bottom" className="button-layer-options" minSize="250px">
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
			</Panel>
		</Group>
	)
})
