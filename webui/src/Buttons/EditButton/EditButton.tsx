import {
	faFileArrowDown,
	faFileArrowUp,
	faFileLines,
	faNoteSticky,
	faSquarePlus,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import './EditButton.css'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useRef, useState } from 'react'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { SomeButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { StaticAlert } from '~/Components/Alert.js'
import { Button } from '~/Components/Button.js'
import { ButtonPreviewBase } from '~/Components/ButtonPreview.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { Grid } from '~/Components/Grid'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { ControlNotesEditor } from '~/Controls/ControlNotesEditor.js'
import { useButtonImageForControlId } from '~/Hooks/useButtonImageForControlId.js'
import { useControlConfig } from '~/Hooks/useControlConfig.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { LoadingRetryOrError } from '~/Resources/Loading.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
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
						<div className="flex mb-0">
							<div className="grow min-w-0 flex flex-col gap-1"></div>
							<ButtonPreviewBase fixedSize={100} preview={previewImage} />
						</div>

						<NonIdealState icon={faSquarePlus} className="px-4">
							<h4 className="my-1">Empty button</h4>
							<p className="my-3">Choose a button type to get started.</p>
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
	resetModalRef: React.RefObject<GenericConfirmModalRef | null>
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
	const [editingNoteForControlId, setEditingNoteForControlId] = useState<string | null>(null)
	const editingNote = editingNoteForControlId === controlId
	const controlNotes =
		config.type === 'button-layered' || config.type === 'preset-reference' || config.type === 'button-reference'
			? config.options.notes
			: undefined
	const hasNote = !!controlNotes?.trim()
	const typeLabel =
		config.type === 'button-layered'
			? 'Regular button'
			: config.type === 'preset-reference'
				? 'Preset reference'
				: config.type === 'button-reference'
					? 'Button reference'
					: config.type === 'pageup'
						? 'Page up'
						: config.type === 'pagedown'
							? 'Page down'
							: 'Page number'

	const resetControlsMutation = useMutationExt(trpc.controls.resetControls.mutationOptions())
	const setOptionsFieldMutation = useMutationExt(trpc.controls.setOptionsField.mutationOptions())
	const clearNote = useCallback(() => {
		setOptionsFieldMutation
			.mutateAsync({ controlId, key: 'notes', value: '' })
			.then(() => setEditingNoteForControlId(null))
			.catch((e) => {
				console.error('Failed to clear notes:', e)
			})
	}, [setOptionsFieldMutation, controlId])
	const changeToRegularButton = useCallback(() => {
		resetControlsMutation.mutateAsync({ locations: [location], newType: 'button-layered' }).catch((e) => {
			console.error('Failed to change button type', e)
		})
	}, [resetControlsMutation, location])

	return (
		<>
			<div className="edit-button-sticky-header">
				<div className="edit-button-summary">
					<div className="edit-button-summary-preview">
						<ButtonPreviewBase fixedSize={100} preview={previewImage} />
					</div>
					<div className="edit-button-summary-identity">
						<strong>Button {formatLocation(location)}</strong>
						<span>{typeLabel}</span>
					</div>
					<div className="edit-button-summary-actions">
						<MyErrorBoundary>
							{(config.type === 'button-layered' ||
								config.type === 'preset-reference' ||
								config.type === 'button-reference') &&
								!hasNote &&
								!editingNote && (
									<Button
										color="secondary"
										variant="ghost"
										size="sm"
										className="edit-button-add-note"
										onClick={() => setEditingNoteForControlId(controlId)}
									>
										<FontAwesomeIcon icon={faNoteSticky} />
										Add note
									</Button>
								)}
							{(config.type === 'pageup' ||
								config.type === 'pagenum' ||
								config.type === 'pagedown' ||
								config.type === 'preset-reference' ||
								config.type === 'button-reference') && <ConvertToNormalButton location={location} />}
							<ControlClearButton location={location} resetModalRef={resetModalRef} />
						</MyErrorBoundary>
					</div>
				</div>

				{(config.type === 'button-layered' ||
					config.type === 'preset-reference' ||
					config.type === 'button-reference') && (
					<section className="edit-button-test-strip" aria-label="Test button">
						<div className="edit-button-section-label">Test button</div>
						<MyErrorBoundary>
							<ControlHotPressButtons
								location={location}
								showRotaries={config.type === 'button-reference' || config.options.rotaryActions}
							/>
						</MyErrorBoundary>
					</section>
				)}

				{(config.type === 'button-layered' ||
					config.type === 'preset-reference' ||
					config.type === 'button-reference') && (
					<MyErrorBoundary>
						{editingNote ? (
							<div className="edit-button-note-card">
								<div className="edit-button-note-heading">
									<span>
										<FontAwesomeIcon icon={faNoteSticky} /> Notes
									</span>
									<div className="edit-button-note-actions">
										<Button color="danger" variant="ghost" size="sm" onClick={clearNote}>
											Clear
										</Button>
										<Button
											color="secondary"
											variant="ghost"
											size="sm"
											onClick={() => setEditingNoteForControlId(null)}
										>
											Done
										</Button>
									</div>
								</div>
								<ControlNotesEditor
									controlId={controlId}
									notes={controlNotes}
									className="edit-button-notes"
									autoFocus
								/>
							</div>
						) : hasNote ? (
							<div className="edit-button-note-metadata">
								<FontAwesomeIcon icon={faNoteSticky} />
								<span title={controlNotes}>{controlNotes}</span>
								<Button
									color="secondary"
									variant="ghost"
									size="sm"
									onClick={() => setEditingNoteForControlId(controlId)}
								>
									Edit
								</Button>
							</div>
						) : null}
					</MyErrorBoundary>
				)}
			</div>

			{config.type === 'pageup' && (
				<NonIdealState icon={faFileArrowUp}>
					<h4 className="my-1 font-semibold text-body">Page up button</h4>
					<p className="my-2 text-sm text-muted">
						Page up buttons automatically navigate to the previous page when pressed.
					</p>
					<Button color="secondary" size="sm" onClick={changeToRegularButton} className="mt-2">
						Change to regular button
					</Button>
				</NonIdealState>
			)}

			{config.type === 'pagenum' && (
				<NonIdealState icon={faFileLines}>
					<h4 className="my-1 font-semibold text-body">Page number button</h4>
					<p className="my-2 text-sm text-muted">
						Page number buttons display the current active page number on your control surface.
					</p>
					<Button color="secondary" size="sm" onClick={changeToRegularButton} className="mt-2">
						Change to regular button
					</Button>
				</NonIdealState>
			)}

			{config.type === 'pagedown' && (
				<NonIdealState icon={faFileArrowDown}>
					<h4 className="my-1 font-semibold text-body">Page down button</h4>
					<p className="my-2 text-sm text-muted">
						Page down buttons automatically navigate to the next page when pressed.
					</p>
					<Button color="secondary" size="sm" onClick={changeToRegularButton} className="mt-2">
						Change to regular button
					</Button>
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
