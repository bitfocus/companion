import { faLayerGroup } from '@fortawesome/free-solid-svg-icons'
import { observer } from 'mobx-react-lite'
import { useMemo, useRef, useState } from 'react'
import type { SomeControlId } from '@companion-app/shared/ControlId.js'
import type { LayeredButtonModel, NormalButtonRuntimeProps } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { ResizeHandle } from '~/Components/ResizeHandle.js'
import { LayeredStyleElementsProvider } from '~/Controls/Components/LayeredStyleElementsContext.js'
import { useLocalVariablesStore, type LocalVariablesStore } from '~/Controls/LocalVariablesStore.js'
import { useSplitResize } from '~/Hooks/useSplitResize.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { LocalVariablesEditor } from '../../../Controls/LocalVariablesEditor.js'
import { ButtonEditorTabs } from '../ButtonEditorTabs.js'
import { FeedbackOverridesTab } from '../FeedbackOverridesTab.js'
import { ControlOptionsEditor } from './ControlOptionsEditor.js'
import { ElementPropertiesEditor } from './ElementPropertiesEditor.js'
import { ElementsList } from './ElementsList.js'
import { PinnedPropertiesEditor } from './PinnedPropertiesEditor.js'
import { LayeredButtonPreviewRenderer } from './Preview/LayeredButtonPreviewRenderer.js'
import { LayeredStyleStore } from './StyleStore.js'

export const LayeredButtonEditor = observer(function LayeredButtonEditor({
	config,
	controlId,
	runtimeProps,
	location,
	activeMainTab,
}: {
	config: LayeredButtonModel
	controlId: SomeControlId
	runtimeProps: NormalButtonRuntimeProps
	location: ControlLocation
	activeMainTab: string
}) {
	const configRef = useRef<LayeredButtonModel>(config)
	configRef.current = config // update the ref every render

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
		<div className="grow flex flex-col min-h-0">
			<MyErrorBoundary>
				<ButtonEditorTabs
					location={location}
					controlId={controlId}
					steps={config.steps || {}}
					runtimeProps={runtimeProps}
					rotaryActions={config?.options?.rotaryActions}
					activeMainTab={activeMainTab}
					localVariablesStore={localVariablesStore}
					disabledSetStep={config?.options?.stepProgression === 'expression'}
				>
					{(currentTab) => {
						if (currentTab === 'style') {
							return (
								<div className="button-editor-tab-content h-full">
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
								<div className="button-editor-tab-content">
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
								<div className="button-editor-tab-content">
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
								<div className="button-editor-tab-content">
									{/* Wrap the entity-category, for :first-child to work */}
									<MyErrorBoundary>
										<ControlOptionsEditor
											options={config.options}
											configRef={configRef}
											controlId={controlId}
											localVariablesStore={localVariablesStore}
										/>
									</MyErrorBoundary>
								</div>
							)
						}

						return null
					}}
				</ButtonEditorTabs>
			</MyErrorBoundary>
		</div>
	)
})

interface LayeredButtonEditorStyleProps {
	controlId: SomeControlId
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
	const isPinnedViewSelected = styleStore.isPinnedViewSelected
	const { rootRef, rootStyle, handleProps } = useSplitResize({
		orientation: 'vertical',
		enabled: true,
		storageKey: 'split-panels-height:layered-editor',
		panelSelectors: ['.button-layer-top', '.button-layer-options'],
		minFirstPx: 200,
		minSecondPx: 250,
		defaultFirstPercent: 45,
	})

	return (
		<div ref={rootRef} className="button-layer-style-editor h-full" style={rootStyle}>
			<div className="button-layer-top">
				<div className="button-layer-preview">
					<LayeredButtonPreviewRenderer controlId={controlId} location={location} styleStore={styleStore} />
				</div>
				<div className="button-layer-elementlist">
					<ElementsList styleStore={styleStore} controlId={controlId} />
				</div>
			</div>
			<div className="button-layer-options">
				{isPinnedViewSelected ? (
					<PinnedPropertiesEditor
						controlId={controlId}
						styleStore={styleStore}
						localVariablesStore={localVariablesStore}
						isPropertyOverridden={styleStore.isPropertyOverridden}
					/>
				) : elementProps ? (
					<ElementPropertiesEditor
						controlId={controlId}
						elementProps={elementProps}
						localVariablesStore={localVariablesStore}
						isPropertyOverridden={styleStore.isPropertyOverridden}
					/>
				) : (
					<NonIdealState icon={faLayerGroup}>
						Select an element from the list above to edit its properties
					</NonIdealState>
				)}
			</div>
			<ResizeHandle {...handleProps} />
		</div>
	)
})
