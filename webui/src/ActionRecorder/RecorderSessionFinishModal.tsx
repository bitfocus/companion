import { faCalendarAlt, faClock } from '@fortawesome/free-solid-svg-icons'
import './RecorderSessionFinishModal.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useMutation } from '@tanstack/react-query'
import { useCallback, useContext, useState } from 'react'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ActionSetId } from '@companion-app/shared/Model/ActionModel.js'
import { Modal } from '~/Components/Modal.js'
import { TabArea } from '~/Components/TabArea.js'
import { trpc } from '~/Resources/TRPC.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { ButtonPicker } from './ButtonPicker.js'
import { TriggerPicker } from './TriggerPicker.js'

interface RecorderSessionFinishModalProps {
	doClose: () => void
	sessionId: string
	actionCount: number
}
export function RecorderSessionFinishModal({
	doClose,
	sessionId,
	actionCount,
}: RecorderSessionFinishModalProps): React.JSX.Element {
	const { notifier, triggersList, pages } = useContext(RootAppStoreContext)
	const [saveError, setSaveError] = useState<string | null>(null)
	const { mutateAsync: saveToControl, isPending: saving } = useMutation(
		trpc.actionRecorder.session.saveToControl.mutationOptions()
	)

	const doSave = useCallback(
		(controlId: string, stepId: string, setId: ActionSetId, mode: 'replace' | 'append') => {
			setSaveError(null)
			const trigger = triggersList.triggers.get(controlId)
			let destination = trigger ? `trigger “${trigger.name}”` : 'the selected button'
			if (!trigger) {
				for (const [pageIndex, page] of pages.data.entries()) {
					for (const [row, columns] of page.controls) {
						for (const [column, id] of columns) {
							if (id === controlId) destination = `button ${formatLocation({ pageNumber: pageIndex + 1, row, column })}`
						}
					}
				}
				const group =
					typeof setId === 'number'
						? `Release after ${setId}ms`
						: { down: 'Press', up: 'Release', rotate_left: 'Rotate left', rotate_right: 'Rotate right' }[setId]
				destination += `, Step ${Number(stepId) + 1} / ${group}`
			}
			saveToControl({ sessionId, controlId, stepId, setId, mode })
				.then(() => {
					doClose()
					notifier.show(
						'Actions saved',
						`${actionCount} recorded ${actionCount === 1 ? 'action' : 'actions'} ${mode === 'append' ? 'appended to' : 'saved to'} ${destination}.${mode === 'replace' ? ' Existing actions were replaced.' : ''}`,
						5000
					)
				})
				.catch((e) => {
					setSaveError(e instanceof Error ? e.message : 'Unable to save recorded actions.')
				})
		},
		[saveToControl, sessionId, doClose, actionCount, notifier, triggersList, pages]
	)

	const onOpenChange = useCallback(
		(open: boolean) => {
			if (!open) doClose()
		},
		[doClose]
	)

	const [activeTab, setActiveTab] = useState<'buttons' | 'triggers'>('buttons')

	return (
		<Modal.Root open={true} onOpenChange={onOpenChange}>
			<Modal.Portal>
				<Modal.Backdrop />
				<Modal.Viewport>
					<Modal.Popup size="lg" scrollable className="modal-full-height recorder-destination-modal">
						<Modal.Header closeButton>
							<Modal.Title>Select destination</Modal.Title>
						</Modal.Header>
						<Modal.Body>
							<div className="recorder-destination-content">
								<p className="recorder-destination-intro">Choose where to save your recorded sequence.</p>
								{saveError && (
									<div className="recorder-destination-error" role="alert">
										{saveError}
									</div>
								)}
								<TabArea.Root value={activeTab} onValueChange={setActiveTab}>
									<TabArea.List>
										<TabArea.Tab value="buttons">
											<FontAwesomeIcon icon={faCalendarAlt} /> Buttons
										</TabArea.Tab>
										<TabArea.Tab value="triggers">
											<FontAwesomeIcon icon={faClock} /> Triggers
										</TabArea.Tab>
									</TabArea.List>
									<TabArea.Panel className="action-recorder-finish-button-grid" value="buttons">
										<ButtonPicker selectButton={doSave} saving={saving} />
									</TabArea.Panel>
									<TabArea.Panel className="recorder-destination-triggers" value="triggers">
										<TriggerPicker selectControl={doSave} saving={saving} />
									</TabArea.Panel>
								</TabArea.Root>
							</div>
						</Modal.Body>
						<Modal.Footer>
							<p className="recorder-destination-help">
								<strong>Append</strong> keeps existing actions. <strong>Replace</strong> overwrites them.
							</p>
							<Modal.Close disabled={saving}>Cancel</Modal.Close>
						</Modal.Footer>
					</Modal.Popup>
				</Modal.Viewport>
			</Modal.Portal>
		</Modal.Root>
	)
}
