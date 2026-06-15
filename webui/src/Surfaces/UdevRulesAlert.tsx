import { useMutation } from '@tanstack/react-query'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext } from 'react'
import { StaticAlert } from '~/Components/Alert'
import { Button } from '~/Components/Button'
import { CopyButton } from '~/Components/CopyButton'
import { useUdevRulesStatus } from '~/Hooks/useUdevRulesStatus'
import { trpc } from '~/Resources/TRPC'
import { RootAppStoreContext } from '~/Stores/RootAppStore'

/**
 * Warns the user when the Linux udev rules that grant access to USB surfaces are out of date,
 * and offers to apply them. Renders nothing when not applicable.
 */
export const UdevRulesAlert = observer(function UdevRulesAlert(): React.JSX.Element | null {
	const { notifier } = useContext(RootAppStoreContext)
	const status = useUdevRulesStatus()

	const recheckMutation = useMutation(trpc.instances.udevRules.recheck.mutationOptions())
	const applyMutation = useMutation(trpc.instances.udevRules.applyRules.mutationOptions())
	const applyMutationAsync = applyMutation.mutateAsync

	const applyRules = useCallback(() => {
		applyMutationAsync().catch((e) => {
			notifier.show('Failed to apply USB permissions', e?.message ?? 'Unknown error')
		})
	}, [applyMutationAsync, notifier])

	if (!status || !status.supported || !status.needsApply) return null

	// When Companion can apply the rules itself, the Apply button is the primary action and it re-checks
	// automatically on success. Otherwise the user applies manually, so we offer the command and a "I've done
	// this" re-check. Either way the actions sit in a right-aligned row below the command.
	return (
		<StaticAlert color="warning" role="alert">
			<p>
				To use your USB surfaces, the system USB permissions need updating. This is needed because the configured
				surface modules have changed.
			</p>

			{status.canAutoApply ? (
				<>
					<p className="mb-1">Apply them automatically below, or run this command manually:</p>
					<pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginBottom: '0.5rem' }}>
						{status.applyCommand}
					</pre>
					<div className="d-flex justify-content-end gap-2">
						<CopyButton text={status.applyCommand} color="secondary" />
						<Button color="primary" size="sm" onClick={applyRules} disabled={applyMutation.isPending}>
							{applyMutation.isPending ? 'Applying…' : 'Apply USB permissions'}
						</Button>
					</div>
				</>
			) : (
				<>
					<p className="mb-1">Run the following command, then reconnect your surfaces:</p>
					<pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginBottom: '0.5rem' }}>
						{status.applyCommand}
					</pre>
					<div className="d-flex justify-content-end gap-2">
						<CopyButton text={status.applyCommand} color="secondary" />
						<Button color="secondary" size="sm" onClick={() => recheckMutation.mutate()}>
							Recheck status
						</Button>
					</div>
				</>
			)}
		</StaticAlert>
	)
})
