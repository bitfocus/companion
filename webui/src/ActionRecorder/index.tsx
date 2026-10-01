import { useSubscription } from '@trpc/tanstack-react-query'
import './Recorder.css'
import { faVideoCamera } from '@fortawesome/free-solid-svg-icons'
import { observer } from 'mobx-react-lite'
import { useCallback, useMemo, useRef } from 'react'
import type { RecordSessionUpdate } from '@companion-app/shared/Model/ActionRecorderModel.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { PanelCollapseHelperProvider } from '~/Helpers/CollapseHelper.js'
import { PageHeader } from '~/Layout/PageHeader.js'
import { PanelEmptyState } from '~/Layout/PanelEmptyState.js'
import { SplitPanels } from '~/Layout/SplitPanels.js'
import { trpc } from '~/Resources/TRPC.js'
import { useComputed } from '~/Resources/util.js'
import { RecorderSession } from './RecorderSession.js'
import { RecorderSessionFinishModal } from './RecorderSessionFinishModal.js'
import { RecorderSessionActions, RecorderSessionHeading } from './RecorderSessionHeading.js'
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
		<div className="page-shell">
			<GenericConfirmModal ref={confirmRef} />

			{sessionsStore.isFinishing && selectedSessionId ? (
				<RecorderSessionFinishModal
					doClose={closeFinishingModal}
					sessionId={selectedSessionId}
					actionCount={actionIds.length}
				/>
			) : (
				''
			)}

			<PageHeader icon={faVideoCamera} title="Action Recorder" />

			<SplitPanels.Root
				showing={null}
				className="action-recorder-split"
				resize={{ storageKey: 'action-recorder', minPrimaryPx: 320, defaultPrimaryPercent: 35 }}
			>
				<SplitPanels.Primary className="recorder-setup">
					<p className="recorder-page-intro">
						Capture actions from supported connections, review them, then save them to a button or trigger.
					</p>

					<div className="action-recorder-session-heading">
						{sessionsStore.selectedSessionInfo && (
							<RecorderSessionHeading confirmRef={confirmRef} sessionInfo={sessionsStore.selectedSessionInfo} />
						)}
					</div>

					<section className="recorder-guide">
						<h2>Recording a sequence</h2>
						<ol>
							<li>Choose the connections you want to record.</li>
							<li>Start recording and operate the connected devices or software.</li>
							<li>Pause to review, edit, or reorder the captured actions.</li>
							<li>Finish to save the sequence to a button or trigger.</li>
						</ol>
						<p>Only connections that support action recording appear in the list.</p>
					</section>
				</SplitPanels.Primary>

				<SplitPanels.Secondary>
					<div className="secondary-panel-simple">
						{selectedSessionId ? (
							<>
								<div className="secondary-panel-simple-header panel-header-compact">
									<div className="recorder-actions-title">
										<h4 className="panel-title">Recorded actions</h4>
										<span>{actionIds.length}</span>
									</div>
									{sessionsStore.selectedSessionInfo && (
										<RecorderSessionActions
											sessionInfo={sessionsStore.selectedSessionInfo}
											doFinish={openFinishingModal}
										/>
									)}
								</div>
								<div className="secondary-panel-simple-body">
									<PanelCollapseHelperProvider storageId="action_recorder" knownPanelIds={actionIds}>
										<RecorderSession sessionId={selectedSessionId} sessionInfo={sessionsStore.selectedSessionInfo} />
									</PanelCollapseHelperProvider>
								</div>
							</>
						) : (
							<PanelEmptyState
								icon={faVideoCamera}
								title="No recording session"
								description="A recording session will appear here once Companion has started one."
							/>
						)}
					</div>
				</SplitPanels.Secondary>
			</SplitPanels.Root>
		</div>
	)
})
