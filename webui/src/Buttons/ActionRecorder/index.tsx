import { useSubscription } from '@trpc/tanstack-react-query'
import './Recorder.css'
import { observer } from 'mobx-react-lite'
import { useCallback, useMemo, useRef } from 'react'
import type { RecordSessionUpdate } from '@companion-app/shared/Model/ActionRecorderModel.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { PanelCollapseHelperProvider } from '~/Helpers/CollapseHelper.js'
import { trpc } from '~/Resources/TRPC.js'
import { useComputed } from '~/Resources/util.js'
import { RecorderSession } from './RecorderSession.js'
import { RecorderSessionFinishModal } from './RecorderSessionFinishModal.js'
import { RecorderSessionHeading } from './RecorderSessionHeading.js'
import { ActionRecorderSessionStore } from './SessionStore.js'

export const ActionRecorder = observer(function ActionRecorder(): React.JSX.Element {
	const confirmRef = useRef<GenericConfirmModalRef>(null)

	const sessionsStore = useMemo(() => new ActionRecorderSessionStore(), [])

	// Subscribe to the list of sessions using tRPC
	useSubscription(
		trpc.actionRecorder.sessionList.subscriptionOptions(undefined, {
			onData: (newSessions) => {
				sessionsStore.updateSessionList(newSessions)
			},
			onError: (e) => {
				console.error('Action record subscribe', e)
			},
		})
	)

	// Subscribe to specific session info using tRPC
	const selectedSessionId = sessionsStore.selectedSessionId
	useSubscription(
		trpc.actionRecorder.session.watch.subscriptionOptions(
			{ sessionId: selectedSessionId || '' },
			{
				enabled: !!selectedSessionId,
				onData: (info) => {
					sessionsStore.updateSessionInfo(info as RecordSessionUpdate) // TODO - some ts mismatch
				},
				onError: (e) => {
					console.error('Action record session subscribe', e)
				},
			}
		)
	)

	const closeFinishingModal = useCallback(() => {
		sessionsStore.isFinishing = false
	}, [sessionsStore])
	const openFinishingModal = useCallback(() => {
		sessionsStore.isFinishing = true
	}, [sessionsStore])

	const actionIds = useComputed(
		() => sessionsStore.selectedSessionInfo?.actions?.map((a) => a.id) ?? [],
		[sessionsStore]
	)

	return (
		<div className="action-recorder-panel buttons-sidebar-section">
			<GenericConfirmModal ref={confirmRef} />

			{sessionsStore.isFinishing && selectedSessionId ? (
				<RecorderSessionFinishModal doClose={closeFinishingModal} sessionId={selectedSessionId} />
			) : (
				''
			)}

			<h5 className="buttons-sidebar-heading">Recorder</h5>
			<div className="action-recorder-session-heading">
				{sessionsStore.selectedSessionInfo && (
					<RecorderSessionHeading
						confirmRef={confirmRef}
						sessionInfo={sessionsStore.selectedSessionInfo}
						doFinish={openFinishingModal}
					/>
				)}
			</div>

			{selectedSessionId ? (
				<section className="recorder-actions-section">
					<div className="recorder-actions-header">
						<h6>Recorded actions</h6>
						<span>{actionIds.length}</span>
					</div>
					<PanelCollapseHelperProvider storageId="action_recorder" knownPanelIds={actionIds}>
						<RecorderSession sessionId={selectedSessionId} sessionInfo={sessionsStore.selectedSessionInfo} />
					</PanelCollapseHelperProvider>
				</section>
			) : (
				<div className="recorder-empty-state">No recording session is available yet.</div>
			)}
		</div>
	)
})
