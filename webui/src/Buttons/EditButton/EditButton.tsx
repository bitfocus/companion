import { faFileArrowDown, faFileArrowUp, faFileLines, faSquarePlus } from '@fortawesome/free-solid-svg-icons'
import { observer } from 'mobx-react-lite'
import { useContext, useRef } from 'react'
import type { SomeButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { StaticAlert } from '~/Components/Alert.js'
import { ButtonPreviewBase } from '~/Components/ButtonPreview.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { Grid } from '~/Components/Grid'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { ControlNotesEditor } from '~/Controls/ControlNotesEditor.js'
import { useButtonImageForControlId } from '~/Hooks/useButtonImageForControlId.js'
import { useControlConfig } from '~/Hooks/useControlConfig.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { LoadingRetryOrError } from '~/Resources/Loading.js'
import { KeyReceiver } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { ButtonReferenceEditor } from './ButtonReferenceEditor.js'
import { ControlClearButton } from './ControlClearButton.js'
import { ControlHotPressButtons } from './ControlHotPressButtons.js'
import { ConvertToNormalButton } from './ConvertToNormalButton.js'
import { CreateButtonTypeButtons } from './CreateButtonTypeButtons.js'
import { LayeredButtonEditor } from './LayeredButtonEditor/LayeredButtonEditor.js'
import { PresetReferenceEditor } from './PresetReferenceEditor.js'

interface EditButtonProps {
	location: ControlLocation
	onKeyUp: (e: React.KeyboardEvent<HTMLDivElement>) => void
	navigateToControl: ((location: ControlLocation) => void) | undefined
}

export const EditButton = observer(function EditButton({ location, onKeyUp, navigateToControl }: EditButtonProps) {
	const { pages } = useContext(RootAppStoreContext)

	const resetModalRef = useRef<GenericConfirmModalRef>(null)

	const controlId = pages.getControlIdAtLocation(location)

	const previewImage = useButtonImageForControlId(controlId || '', !controlId)

	const { controlConfig, error: configError, reloadConfig } = useControlConfig(controlId)

	const errors: string[] = []
	if (configError) errors.push(configError)
	const loadError = errors.length > 0 ? errors.join(', ') : null
	const dataReady = !loadError && !!controlConfig

	return (
		<KeyReceiver onKeyUp={onKeyUp} tabIndex={0} className="edit-button-panel flex-form">
			{controlId ? (
				<>
					<GenericConfirmModal ref={resetModalRef} />
					<LoadingRetryOrError dataReady={dataReady} error={loadError} doRetry={reloadConfig} design="pulse" />
					{dataReady &&
						(controlConfig.config.type === 'trigger' ||
						controlConfig.config.type === 'expression-variable' ||
						controlConfig.config.type === 'page' ? (
							<StaticAlert color="warning">
								An incompatible control was selected! This is likely a bug, please report it.
							</StaticAlert>
						) : (
							<EditButtonContent
								resetModalRef={resetModalRef}
								controlId={controlId}
								location={location}
								previewImage={previewImage}
								config={controlConfig.config}
								runtimeProps={controlConfig.runtime}
								navigateToControl={navigateToControl}
							/>
						))}
				</>
			) : (
				<>
					<Grid.Col sm={12}>
						<div className="d-flex mb-0">
							<div className="flex-grow-1 min-w-0 d-flex flex-column gap-1"></div>
							<ButtonPreviewBase fixedSize={100} preview={previewImage} />
						</div>

						<NonIdealState icon={faSquarePlus} className="px-3">
							<h4 className="mt-1">Empty button</h4>
							<p className="mt-3">Choose a button type to get started.</p>
							<MyErrorBoundary>
								<CreateButtonTypeButtons location={location} />
							</MyErrorBoundary>
						</NonIdealState>
					</Grid.Col>
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
	navigateToControl: ((location: ControlLocation) => void) | undefined
}
const EditButtonContent = observer(function EditButton({
	resetModalRef,
	controlId,
	location,
	previewImage,
	config,
	runtimeProps,
	navigateToControl,
}: EditButtonContentProps) {
	return (
		<>
			<div className="d-flex mb-0">
				<div className="flex-grow-1 min-w-0 d-flex flex-column gap-1">
					<div className="d-flex flex-wrap align-items-center gap-1">
						<ControlClearButton location={location} resetModalRef={resetModalRef} />
						<MyErrorBoundary>
							{(config.type === 'pageup' ||
								config.type === 'pagenum' ||
								config.type === 'pagedown' ||
								config.type === 'preset-reference' ||
								config.type === 'button-reference') && <ConvertToNormalButton location={location} />}
							{(config.type === 'button-layered' ||
								config.type === 'preset-reference' ||
								config.type === 'button-reference') && (
								<ControlHotPressButtons
									location={location}
									showRotaries={config.type === 'button-reference' || config.options.rotaryActions}
								/>
							)}
						</MyErrorBoundary>
					</div>
					{(config.type === 'button-layered' ||
						config.type === 'preset-reference' ||
						config.type === 'button-reference') && (
						<MyErrorBoundary>
							<ControlNotesEditor controlId={controlId} notes={config.options.notes} className="w-100 mt-1" />
						</MyErrorBoundary>
					)}
				</div>
				<ButtonPreviewBase fixedSize={100} preview={previewImage} />
			</div>

			{config.type === 'pageup' && (
				<NonIdealState icon={faFileArrowUp}>
					<h4 className="mt-1">Page up button</h4>
					<p className="mt-3">No configuration available for page up buttons</p>
				</NonIdealState>
			)}

			{config.type === 'pagenum' && (
				<NonIdealState icon={faFileLines}>
					<h4 className="mt-1">Page number button</h4>
					<p className="mt-3">No configuration available for page number buttons</p>
				</NonIdealState>
			)}

			{config.type === 'pagedown' && (
				<NonIdealState icon={faFileArrowDown}>
					<h4 className="mt-1">Page down button</h4>
					<p className="mt-3">No configuration available for page down buttons</p>
				</NonIdealState>
			)}

			{config.type === 'preset-reference' && (
				<MyErrorBoundary>
					<PresetReferenceEditor config={config} location={location} />
				</MyErrorBoundary>
			)}

			{config.type === 'button-reference' && (
				<MyErrorBoundary>
					<ButtonReferenceEditor config={config} controlId={controlId} navigateToControl={navigateToControl} />
				</MyErrorBoundary>
			)}

			{config.type === 'button-layered' && (
				<LayeredButtonEditor config={config} controlId={controlId} runtimeProps={runtimeProps} location={location} />
			)}
		</>
	)
})
