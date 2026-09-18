import { Check, Pause, Play, Trash2, X } from 'lucide-react'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useId, type RefObject } from 'react'
import type { RecordSessionInfo } from '@companion-app/shared/Model/ActionRecorderModel.js'
import type { DropdownChoice, DropdownChoiceId } from '@companion-app/shared/Model/Common.js'
import { Button } from '~/Components/Button'
import { Form, FormLabel } from '~/Components/Form.js'
import type { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { MultiDropdownInputField } from '~/Components/MultiDropdownInputField.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { PreventDefaultHandler, useComputed } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

interface RecorderSessionHeadingProps {
	confirmRef: RefObject<GenericConfirmModalRef | null>
	sessionInfo: RecordSessionInfo
	doFinish: () => void
}

export const RecorderSessionHeading = observer(function RecorderSessionHeading({
	confirmRef,
	sessionInfo,
	doFinish,
}: RecorderSessionHeadingProps) {
	const { connections } = useContext(RootAppStoreContext)

	const discardActionsMutation = useMutationExt(trpc.actionRecorder.session.discardActions.mutationOptions())
	const abortSessionMutation = useMutationExt(trpc.actionRecorder.session.abort.mutationOptions())
	const setRecordingMutation = useMutationExt(trpc.actionRecorder.session.setRecording.mutationOptions())
	const setConnectionsMutation = useMutationExt(trpc.actionRecorder.session.setConnections.mutationOptions())

	const sessionId = sessionInfo.id
	const doClearActions = useCallback(() => {
		discardActionsMutation.mutateAsync({ sessionId }).catch((e) => {
			console.error(e)
		})
	}, [discardActionsMutation, sessionId])

	const doAbort = useCallback(() => {
		if (confirmRef.current) {
			confirmRef.current.show(
				'Discard session',
				'Are you sure you wish to discard the current session?',
				'Discard',
				() => {
					abortSessionMutation.mutateAsync({ sessionId }).catch((e) => {
						console.error(e)
					})
				}
			)
		}
	}, [abortSessionMutation, sessionId, confirmRef])

	const changeRecording = useCallback(
		(isRunning: boolean) => {
			setRecordingMutation.mutateAsync({ sessionId, isRunning }).catch((e) => {
				console.error(e)
			})
		},
		[setRecordingMutation, sessionId]
	)

	const doFinish2 = useCallback(() => {
		changeRecording(false)

		doFinish()
	}, [changeRecording, doFinish])
	const toggleRecording = useCallback(
		() => changeRecording(!sessionInfo.isRunning),
		[changeRecording, sessionInfo.isRunning]
	)

	const changeConnectionIds = useCallback(
		(ids: DropdownChoiceId[]) => {
			const connectionIds = ids.map((id) => String(id))
			setConnectionsMutation.mutateAsync({ sessionId, connectionIds }).catch((e) => {
				console.error(e)
			})
		},
		[setConnectionsMutation, sessionId]
	)

	const connectionsWhichCanRecord = useComputed(() => {
		const result: DropdownChoice[] = []

		for (const [id, info] of connections.connections.entries()) {
			if (info.hasRecordActionsHandler) {
				result.push({
					id,
					label: info.label,
				})
			}
		}

		return result
	}, [connections])

	const connectionsFieldId = useId()

	return (
		<Form
			onSubmit={PreventDefaultHandler}
			className={`recorder-session-card${sessionInfo.isRunning ? ' recorder-session-card-active' : ''}`}
		>
			<div className="recorder-state-summary" aria-live="polite">
				<span
					aria-hidden="true"
					className={sessionInfo.isRunning ? 'recorder-state-dot recorder-state-dot-active' : 'recorder-state-dot'}
				/>
				<div>
					<strong>{sessionInfo.isRunning ? 'Recording in progress' : 'Recording paused'}</strong>
					<p>
						{sessionInfo.isRunning
							? 'New actions will appear below as they happen.'
							: 'Choose connections, then start recording.'}
					</p>
				</div>
			</div>
			<div className="recorder-session-fields">
				<div className="recorder-connections-field">
					<FormLabel htmlFor={connectionsFieldId}>Connections</FormLabel>
					<MultiDropdownInputField
						htmlName={connectionsFieldId}
						value={sessionInfo.connectionIds}
						setValue={changeConnectionIds}
						choices={connectionsWhichCanRecord}
					/>
				</div>
			</div>
			<div className="recorder-session-actions">
				<Button type="button" color={sessionInfo.isRunning ? 'danger' : 'primary'} size="sm" onClick={toggleRecording}>
					{sessionInfo.isRunning ? <Pause size={14} /> : <Play size={14} />}
					{sessionInfo.isRunning ? 'Pause recording' : 'Start recording'}
				</Button>
				<div className="recorder-session-secondary-actions">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={doClearActions}
						disabled={!sessionInfo.actions?.length}
					>
						<Trash2 size={14} /> Clear
					</Button>
					<Button type="button" variant="ghost" size="sm" onClick={doAbort} className="recorder-discard-button">
						<X size={14} /> Discard
					</Button>
					<Button type="button" color="secondary" size="sm" onClick={doFinish2} disabled={!sessionInfo.actions?.length}>
						<Check size={14} /> Finish
					</Button>
				</div>
			</div>
		</Form>
	)
})
