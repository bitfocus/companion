import { CCol } from '@coreui/react'
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { ButtonPreviewBase } from '../../Components/ButtonPreview.js'
import { GenericConfirmModal, GenericConfirmModalRef } from '../../Components/GenericConfirmModal.js'
import { KeyReceiver, LoadingRetryOrError, MyErrorBoundary } from '../../util.js'
import jsonPatch from 'fast-json-patch'
import { ButtonStyleConfig } from '../../Controls/ButtonStyleConfig.js'
import { ControlOptionsEditor } from '../../Controls/ControlOptionsEditor.js'
import { cloneDeep } from 'lodash-es'
import { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { NormalButtonModel, SomeButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import { RootAppStoreContext } from '../../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { ControlClearButton } from './ControlClearButton.js'
import { SelectButtonTypeDropdown } from './SelectButtonTypeDropdown.js'
import { ControlHotPressButtons } from './ControlHotPressButtons.js'
import { ButtonEditorExtraTabs, ButtonEditorTabs } from './ButtonEditorTabs.js'
import { ControlEntitiesEditor } from '../../Controls/EntitiesEditor.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { LocalVariablesEditor } from './LocalVariablesEditor.js'
import { useLocalVariablesStore } from '../../Controls/LocalVariablesStore.js'

interface EditButtonProps {
	location: ControlLocation
	onKeyUp: (e: React.KeyboardEvent<HTMLDivElement>) => void
}

export const EditButton = observer(function EditButton({ location, onKeyUp }: EditButtonProps) {
	const { socket, pages } = useContext(RootAppStoreContext)

	const resetModalRef = useRef<GenericConfirmModalRef>(null)

	const controlId = pages.getControlIdAtLocation(location)

	const [previewImage, setPreviewImage] = useState<string | null>(null)
	const [config, setConfig] = useState<SomeButtonModel | null | false>(null)
	const [runtimeProps, setRuntimeProps] = useState<Record<string, any> | null | false>(null)

	const [configError, setConfigError] = useState<string | null>(null)

	const [reloadConfigToken, setReloadConfigToken] = useState(nanoid())

	useEffect(() => {
		if (!controlId) {
			setConfig(false)
			setRuntimeProps({})
			setConfigError(null)
			setPreviewImage(null)

			return
		}

		setConfig(null)
		setConfigError(null)
		setPreviewImage(null)
		setRuntimeProps(null)

		socket
			.emitPromise('controls:subscribe', [controlId])
			.then((config) => {
				console.log(config)
				setConfig((config as any)?.config ?? false)
				setRuntimeProps(config?.runtime ?? {})
				setConfigError(null)
			})
			.catch((e) => {
				console.error('Failed to load control config', e)
				setConfig(null)
				setConfigError('Failed to load control config')
			})

		const unsubConfig = socket.on(`controls:config-${controlId}`, (patch) => {
			setConfig((oldConfig) => {
				if (!oldConfig) return oldConfig
				if (patch === false) {
					return false
				} else {
					return jsonPatch.applyPatch(cloneDeep(oldConfig), patch).newDocument
				}
			})
		})
		const unsubRuntimeProps = socket.on(`controls:runtime-${controlId}`, (patch) => {
			setRuntimeProps((oldProps) => {
				if (!oldProps) return oldProps
				if (patch === false) {
					return {}
				} else {
					return jsonPatch.applyPatch(cloneDeep(oldProps), patch).newDocument
				}
			})
		})

		const unsubPreview = socket.on(`controls:preview-${controlId}`, (img) => {
			setPreviewImage(img)
		})

		return () => {
			unsubConfig()
			unsubRuntimeProps()
			unsubPreview()

			socket.emitPromise('controls:unsubscribe', [controlId]).catch((e) => {
				console.error('Failed to unsubscribe bank config', e)
			})
		}
	}, [socket, controlId, reloadConfigToken])

	const doRetryLoad = useCallback(() => setReloadConfigToken(nanoid()), [])

	const errors: string[] = []
	if (configError) errors.push(configError)
	const loadError = errors.length > 0 ? errors.join(', ') : null
	const hasConfig = !!config
	const hasRuntimeProps = !!runtimeProps || runtimeProps === false
	const dataReady = !loadError && hasConfig && hasRuntimeProps

	return (
		<KeyReceiver onKeyUp={onKeyUp} tabIndex={0} className="edit-button-panel flex-form">
			{controlId ? (
				<>
					<GenericConfirmModal ref={resetModalRef} />
					<LoadingRetryOrError dataReady={dataReady} error={loadError} doRetry={doRetryLoad} />
					{hasConfig && dataReady && (
						<EditButtonContent
							resetModalRef={resetModalRef}
							controlId={controlId}
							location={location}
							previewImage={previewImage}
							config={config}
							runtimeProps={runtimeProps}
						/>
					)}
				</>
			) : (
				<>
					<CCol sm={12}>
						<ButtonPreviewBase fixedSize preview={previewImage} right={true} />
						<MyErrorBoundary>
							<SelectButtonTypeDropdown location={location} resetModalRef={resetModalRef} configRef={undefined} />
						</MyErrorBoundary>

						<h4>Empty button</h4>
						<p className="mt-3">
							To get started, click button above to create a regular button, or use the drop down to make a special
							button.
						</p>
					</CCol>
				</>
			)}
		</KeyReceiver>
	)
})

interface EditButtonContentProps {
	resetModalRef: React.RefObject<GenericConfirmModalRef>
	controlId: string
	location: ControlLocation
	previewImage: string | null
	config: SomeButtonModel
	runtimeProps: Record<string, any> | false
}
const EditButtonContent = observer(function EditButton({
	resetModalRef,
	controlId,
	location,
	previewImage,
	config,
	runtimeProps,
}: EditButtonContentProps) {
	return (
		<>
			<CCol sm={12}>
				<ButtonPreviewBase fixedSize preview={previewImage} right={true} />

				<ControlClearButton location={location} resetModalRef={resetModalRef} />
				<MyErrorBoundary>
					{config.type === 'button' && (
						<ControlHotPressButtons location={location} showRotaries={config.options.rotaryActions} />
					)}
				</MyErrorBoundary>
			</CCol>

			{config.type === 'pageup' && (
				<>
					<h4>Page up button</h4>
					<p className="mt-3">No configuration available for page up buttons</p>
				</>
			)}

			{config.type === 'pagenum' && (
				<>
					<h4>Page number button</h4>
					<p className="mt-3">No configuration available for page number buttons</p>
				</>
			)}

			{config.type === 'pagedown' && (
				<>
					<h4>Page down button</h4>
					<p className="mt-3">No configuration available for page down buttons</p>
				</>
			)}

			{config.type === 'button' && (
				<NormalButtonEditor config={config} controlId={controlId} runtimeProps={runtimeProps} location={location} />
			)}
		</>
	)
})

const NormalButtonExtraTabs: ButtonEditorExtraTabs[] = [
	{ id: 'feedbacks', name: 'Feedbacks' },
	{ id: 'variables', name: 'Local Variables' },
]

function NormalButtonEditor({
	config,
	controlId,
	runtimeProps,
	location,
}: {
	config: NormalButtonModel
	controlId: string
	runtimeProps: Record<string, any> | false
	location: ControlLocation
}) {
	const configRef = useRef<SomeButtonModel>()
	configRef.current = config || undefined // update the ref every render

	const localVariablesStore = useLocalVariablesStore(controlId, config.localVariables)

	return (
		<>
			<MyErrorBoundary>
				<ButtonStyleConfig
					style={config.style}
					configRef={configRef}
					controlId={controlId}
					localVariablesStore={localVariablesStore}
					mainDialog
				/>
			</MyErrorBoundary>
			<MyErrorBoundary>
				<div style={{ marginLeft: '5px' }}>
					<ControlOptionsEditor options={config.options} configRef={configRef} controlId={controlId} />
				</div>
			</MyErrorBoundary>
			{runtimeProps && (
				<MyErrorBoundary>
					<ButtonEditorTabs
						location={location}
						controlId={controlId}
						steps={config.steps || {}}
						runtimeProps={runtimeProps}
						rotaryActions={config?.options?.rotaryActions}
						extraTabs={NormalButtonExtraTabs}
						localVariablesStore={localVariablesStore}
					>
						{(currentTab) => {
							if (currentTab === 'feedbacks') {
								return (
									<div className="mt-10">
										{/* Wrap the entity-category, for :first-child to work */}
										<MyErrorBoundary>
											<ControlEntitiesEditor
												heading="Feedbacks"
												controlId={controlId}
												entities={config.feedbacks}
												location={location}
												listId="feedbacks"
												entityType={EntityModelType.Feedback}
												entityTypeLabel="feedback"
												onlyFeedbackType={null}
												localVariablesStore={localVariablesStore}
											/>
										</MyErrorBoundary>
									</div>
								)
							} else if (currentTab === 'variables') {
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

							return null
						}}
					</ButtonEditorTabs>
				</MyErrorBoundary>
			)}
		</>
	)
}
