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
	sessionInfo,
	confirmRef,
}: Pick<RecorderSessionHeadingProps, 'sessionInfo' | 'confirmRef'>) {
	const { connections } = useContext(RootAppStoreContext)
	const setRecordingMutation = useMutationExt(trpc.actionRecorder.session.setRecording.mutationOptions())
	const setConnectionsMutation = useMutationExt(trpc.actionRecorder.session.setConnections.mutationOptions())

	const abortSessionMutation = useMutationExt(trpc.actionRecorder.session.abort.mutationOptions())
	const sessionId = sessionInfo.id
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
				<Button type="button" color="secondary" size="sm" onClick={toggleRecording}>
					{sessionInfo.isRunning ? <Pause size={14} /> : <Play size={14} />}
					{sessionInfo.isRunning ? 'Pause recording' : 'Start recording'}
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={doAbort}
					className="recorder-discard-button"
					color="danger"
				>
					<X size={14} /> Discard session
				</Button>
				<div className="recorder-status" aria-live="polite">
					<span
						aria-hidden="true"
						className={sessionInfo.isRunning ? 'recorder-state-dot recorder-state-dot-active' : 'recorder-state-dot'}
					/>
					<span aria-label={sessionInfo.isRunning ? 'Recording in progress' : 'Recording paused'}>
						{sessionInfo.isRunning ? 'Recording' : 'Paused'}
					</span>
				</div>
			</div>
		</Form>
	)
})

export const RecorderSessionActions = observer(function RecorderSessionActions({
	sessionInfo,
	doFinish,
}: Pick<RecorderSessionHeadingProps, 'sessionInfo' | 'doFinish'>) {
	const discardActionsMutation = useMutationExt(trpc.actionRecorder.session.discardActions.mutationOptions())

	const sessionId = sessionInfo.id
	const doClearActions = useCallback(() => {
		discardActionsMutation.mutateAsync({ sessionId }).catch((e) => {
			console.error(e)
		})
	}, [discardActionsMutation, sessionId])

	const setRecordingMutation = useMutationExt(trpc.actionRecorder.session.setRecording.mutationOptions())
	const doFinish2 = useCallback(() => {
		setRecordingMutation.mutateAsync({ sessionId, isRunning: false }).catch(console.error)
		doFinish()
	}, [setRecordingMutation, sessionId, doFinish])
	return (
		<div className="recorder-session-secondary-actions">
			<Button
				type="button"
				variant="ghost"
				size="sm"
				onClick={doClearActions}
				disabled={!sessionInfo.actions?.length}
				color="danger"
			>
				<Trash2 size={14} /> Clear actions
			</Button>

			<Button type="button" color="primary" size="sm" onClick={doFinish2} disabled={!sessionInfo.actions?.length}>
				<Check size={14} /> Finish
			</Button>
		</div>
	)
})
