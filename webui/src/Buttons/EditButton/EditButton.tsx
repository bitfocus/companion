import { faFileArrowDown, faFileArrowUp, faFileLines } from '@fortawesome/free-solid-svg-icons'
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
import { ControlClearButton } from './ControlClearButton.js'
import { ControlHotPressButtons } from './ControlHotPressButtons.js'
import { LayeredButtonEditor } from './LayeredButtonEditor/LayeredButtonEditor.js'
import { SelectButtonTypeDropdown } from './SelectButtonTypeDropdown.js'

interface EditButtonProps {
	location: ControlLocation
	onKeyUp: (e: React.KeyboardEvent<HTMLDivElement>) => void
}

export const EditButton = observer(function EditButton({ location, onKeyUp }: EditButtonProps) {
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
						(controlConfig.config.type === 'trigger' || controlConfig.config.type === 'expression-variable' ? (
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
							/>
						))}
				</>
			) : (
				<>
					<Grid.Col sm={12}>
						<ButtonPreviewBase fixedSize={100} preview={previewImage} right={true} />
						<MyErrorBoundary>
							<SelectButtonTypeDropdown location={location} resetModalRef={resetModalRef} configRef={undefined} />
						</MyErrorBoundary>

						<h4>Empty button</h4>
						<p className="mt-3">
							To get started, click button above to create a regular button, or use the drop down to make a special
							button.
						</p>
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
			<div className="d-flex mb-0">
				<div className="flex-grow-1 min-w-0 d-flex flex-column gap-1">
					<div className="d-flex flex-wrap align-items-center gap-1">
						<ControlClearButton location={location} resetModalRef={resetModalRef} />
						<MyErrorBoundary>
							{config.type === 'button-layered' && (
								<ControlHotPressButtons location={location} showRotaries={config.options.rotaryActions} />
							)}
						</MyErrorBoundary>
					</div>
					{config.type === 'button-layered' && (
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

			{config.type === 'button-layered' && (
				<LayeredButtonEditor config={config} controlId={controlId} runtimeProps={runtimeProps} location={location} />
			)}
		</>
	)
})
