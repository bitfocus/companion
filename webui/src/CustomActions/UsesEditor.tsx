import { faLink, faStop } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Link } from '@tanstack/react-router'
import { useSubscription } from '@trpc/tanstack-react-query'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useState } from 'react'
import type { CustomActionControlId } from '@companion-app/shared/ControlId.js'
import type {
	CustomActionRunInfo,
	CustomActionUsage,
	CustomActionUse,
} from '@companion-app/shared/Model/CustomActionModel.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import { Button } from '~/Components/Button.js'
import { ListHeading } from '~/Components/ListHeading.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { useNow } from '~/Hooks/useNow.js'
import { LoadingRetryOrError } from '~/Resources/Loading.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { assertNever } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import './UsesEditor.css'
import { describeUseControl, formatElapsed, type UseControlLink } from './UsesDescription.js'

interface CustomActionUsesEditorProps {
	controlId: CustomActionControlId
	/** Whether a test run, started from the editor, is running */
	testRunning: boolean
}

/**
 * The actions which call a custom action, whether each is running it, and a way to stop them, such as when one is
 * stuck in a loop
 */
export function CustomActionUsesEditor({ controlId, testRunning }: CustomActionUsesEditorProps): React.JSX.Element {
	const [usage, setUsage] = useState<CustomActionUsage | null>(null)
	const [error, setError] = useState<string | null>(null)

	const sub = useSubscription(
		trpc.controls.customActions.watchUsage.subscriptionOptions(
			{ controlId },
			{
				onStarted: () => {
					setError(null)
					setUsage(null)
				},
				onData: (data) => {
					setError(null)
					setUsage(data)
				},
				onError: (e) => setError(`Failed to load the uses: ${e.message}`),
			}
		)
	)

	const abortAllMutation = useMutationExt(trpc.controls.customActions.abortAll.mutationOptions())
	const abortAll = useCallback(() => {
		abortAllMutation
			.mutateAsync({ controlId })
			.catch((e) => console.error(`Failed to abort the runs: ${stringifyError(e)}`))
	}, [abortAllMutation, controlId])

	const anyRunning = testRunning || !!usage?.otherRuns.length || !!usage?.uses.some((use) => use.runs.length > 0)

	return (
		<div className="custom-action-uses">
			<ListHeading
				heading="Uses"
				subheading={
					<p className="text-sm text-muted">
						The actions which call this custom action, and the runs of it in progress. A run which doesn't finish, such
						as a loop which never ends, can be stopped here.
					</p>
				}
				actions={
					<Button size="sm" color="danger" onClick={abortAll} disabled={!anyRunning} title="Stop every run of it">
						<FontAwesomeIcon icon={faStop} className="me-1.5 text-2xs" />
						Abort all
					</Button>
				}
				collapse={null}
			/>

			<LoadingRetryOrError dataReady={!!usage} error={error} doRetry={sub.reset} design="pulse" />

			{usage && (
				<>
					{usage.uses.length === 0 && !testRunning && usage.otherRuns.length === 0 ? (
						<NonIdealState icon={faLink} text="Nothing calls this custom action yet" />
					) : (
						<ul className="custom-action-uses-list">
							{testRunning && <TestRunRow controlId={controlId} />}
							{usage.uses.map((use) => (
								<UseRow key={`${use.controlId}:${use.entityId}`} customActionId={controlId} use={use} />
							))}
							{usage.otherRuns.length > 0 && <OtherRunsRow runs={usage.otherRuns} />}
						</ul>
					)}
				</>
			)}
		</div>
	)
}

function TestRunRow({ controlId }: { controlId: CustomActionControlId }) {
	const abortMutation = useMutationExt(trpc.controls.customActions.abortTestRun.mutationOptions())
	const abort = useCallback(() => {
		abortMutation
			.mutateAsync({ controlId })
			.catch((e) => console.error(`Failed to abort the test run: ${stringifyError(e)}`))
	}, [abortMutation, controlId])

	return (
		<li className="custom-action-use">
			<div className="custom-action-use-name">
				<span className="custom-action-use-kind">Editor</span>
				Test run
			</div>
			<div className="custom-action-use-status running">Running</div>
			<Button size="sm" color="danger" variant="outline" onClick={abort} title="Stop the test run">
				Abort
			</Button>
		</li>
	)
}

const UseRow = observer(function UseRow({
	customActionId,
	use,
}: {
	customActionId: CustomActionControlId
	use: CustomActionUse
}) {
	const stores = useContext(RootAppStoreContext)
	const description = describeUseControl(use.controlId, stores)

	const abortMutation = useMutationExt(trpc.controls.customActions.abortUse.mutationOptions())
	const abort = useCallback(() => {
		abortMutation
			.mutateAsync({ controlId: customActionId, entityId: use.entityId })
			.catch((e) => console.error(`Failed to abort the runs: ${stringifyError(e)}`))
	}, [abortMutation, customActionId, use.entityId])

	return (
		<li className="custom-action-use">
			<div className="custom-action-use-name">
				<span className="custom-action-use-kind">{description.kind}</span>
				<UseControlName name={description.name} link={description.link} />
			</div>
			<RunsStatus runs={use.runs} useControlId={use.controlId} disabled={use.disabled} />
			<Button
				size="sm"
				color="danger"
				variant="outline"
				onClick={abort}
				disabled={use.runs.length === 0}
				title="Stop the runs started by this action"
			>
				Abort
			</Button>
		</li>
	)
})

/** The name of a control which uses a custom action or feedback, linking to roughly where it is */
export function UseControlName({ name, link }: { name: string; link: UseControlLink | null }): React.JSX.Element {
	if (!link) return <>{name}</>

	switch (link.type) {
		case 'buttons-page':
			return (
				<Link to="/buttons/$page" params={{ page: String(link.pageNumber) }} title="Show its page of buttons">
					{name}
				</Link>
			)
		case 'trigger':
			return (
				<Link to="/triggers/$controlId" params={{ controlId: link.triggerId }} title="Edit the trigger">
					{name}
				</Link>
			)
		case 'custom-action':
			return (
				<Link
					to="/custom-actions/$controlId"
					params={{ controlId: link.customActionId }}
					title="Edit the custom action"
				>
					{name}
				</Link>
			)
		case 'custom-feedback':
			return (
				<Link
					to="/custom-feedbacks/$controlId"
					params={{ controlId: link.customFeedbackId }}
					title="Edit the custom feedback"
				>
					{name}
				</Link>
			)
		case 'custom-preset':
			return (
				<Link
					to="/custom-presets/$controlId"
					params={{ controlId: link.customPresetId }}
					title="Edit the custom preset"
				>
					{name}
				</Link>
			)
		default:
			assertNever(link)
			return <>{name}</>
	}
}

function OtherRunsRow({ runs }: { runs: CustomActionRunInfo[] }) {
	return (
		<li className="custom-action-use">
			<div className="custom-action-use-name">
				<span className="custom-action-use-kind">Removed</span>
				Actions which have since been removed
			</div>
			<RunsStatus runs={runs} useControlId={null} disabled={false} />
			<div />
		</li>
	)
}

const RunsStatus = observer(function RunsStatus({
	runs,
	useControlId,
	disabled,
}: {
	runs: CustomActionRunInfo[]
	/** The control holding the calling action, so that runs started from elsewhere can say so */
	useControlId: string | null
	disabled: boolean
}) {
	const stores = useContext(RootAppStoreContext)
	const now = useNow(1000)

	if (runs.length === 0) {
		return <div className="custom-action-use-status">{disabled ? 'Disabled' : 'Not running'}</div>
	}

	const longest = Math.max(...runs.map((run) => now - run.startedAt))
	// A call inside another custom action runs from the control which started the outer run
	const fromElsewhere = [...new Set(runs.filter((run) => run.controlId !== useControlId).map((run) => run.controlId))]

	return (
		<div className="custom-action-use-status running">
			{runs.length === 1 ? 'Running' : `${runs.length} runs`} for {formatElapsed(longest)}
			{fromElsewhere.length > 0 && (
				<span className="custom-action-use-from">
					from{' '}
					{fromElsewhere
						.map((controlId) => {
							const description = describeUseControl(controlId, stores)
							return `${description.kind} ${description.name}`
						})
						.join(', ')}
				</span>
			)}
		</div>
	)
})
