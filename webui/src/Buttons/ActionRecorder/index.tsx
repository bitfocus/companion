import React, { useCallback, useRef, useMemo } from 'react'
import { CCallout, CCol, CRow } from '@coreui/react'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import type { RecordSessionUpdate } from '@companion-app/shared/Model/ActionRecorderModel.js'
import { RecorderSessionFinishModal } from './RecorderSessionFinishModal.js'
import { RecorderSessionHeading } from './RecorderSessionHeading.js'
import { RecorderSession } from './RecorderSession.js'
import { PanelCollapseHelperProvider } from '~/Helpers/CollapseHelper.js'
import { useSubscription } from '@trpc/tanstack-react-query'
import { trpc } from '~/Resources/TRPC.js'
import { useComputed } from '~/Resources/util.js'
import { observer } from 'mobx-react-lite'
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
		<CRow className="action-recorder-panel">
			<GenericConfirmModal ref={confirmRef} />

			{sessionsStore.isFinishing && selectedSessionId ? (
				<RecorderSessionFinishModal doClose={closeFinishingModal} sessionId={selectedSessionId} />
			) : (
				''
			)}

			<CCol xs={12} className={'row-heading'}>
				<h5>Action Recorder</h5>
				<p>
					You can use this panel to record actions as you make changes directly on a configured device. <br />
					Not many modules support this, and they don't support it for every action.
				</p>
				<div style={{ margin: -12, marginTop: 10 }}>
					{sessionsStore.selectedSessionInfo && (
						<RecorderSessionHeading
							confirmRef={confirmRef}
							sessionInfo={sessionsStore.selectedSessionInfo}
							doFinish={openFinishingModal}
						/>
					)}
				</div>
			</CCol>

			{selectedSessionId ? (
				<PanelCollapseHelperProvider storageId="action_recorder" knownPanelIds={actionIds}>
					<RecorderSession sessionId={selectedSessionId} sessionInfo={sessionsStore.selectedSessionInfo} />
				</PanelCollapseHelperProvider>
			) : (
				<CCallout color="danger">There is no session, this looks like a bug!</CCallout>
			)}
		</CRow>
	)
})
