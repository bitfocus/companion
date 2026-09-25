import { faCloud, faKey, faLock, faServer, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useSubscription } from '@trpc/tanstack-react-query'
import './cloud.css'
import { memo, useId, useState } from 'react'
import type { CloudControllerState } from '@companion-app/shared/Model/Cloud.js'
import { StaticAlert } from '~/Components/Alert.js'
import { Button } from '~/Components/Button'
import { Callout } from '~/Components/Callout.js'
import { CopyButton } from '~/Components/CopyButton.js'
import { FormLabel } from '~/Components/Form.js'
import { SwitchInputFieldWithLabel } from '~/Components/SwitchInputField.js'
import { PageHeader } from '~/Layout/PageHeader.js'
import { LoadingRetryOrError } from '~/Resources/Loading.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { CloudRegionPanel } from './RegionPanel.js'
import { CloudUserPass } from './UserPass.js'

export function CloudPage(): React.JSX.Element {
	const cloudState = useCloudState()

	return (
		<div className="page-shell">
			<PageHeader icon={faCloud} title="Companion Cloud" />

			<div className="page-scroll space-y-4 max-w-4xl pb-8">
				{/* Deprecation notice banner */}
				<div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
					<FontAwesomeIcon icon={faTriangleExclamation} className="text-amber-500 text-lg mt-0.5 shrink-0" />
					<div className="text-xs text-body leading-relaxed space-y-1">
						<div className="font-bold text-sm text-body">Service Deprecation Notice</div>
						<p className="mb-0 text-muted">
							This service is deprecated and will be removed in a future version of Companion. As an alternative, you
							can use the <strong>companion-satellite</strong> module over a local network or VPN.
						</p>
					</div>
				</div>

				<p className="text-xs text-muted leading-relaxed">
					Access your Companion buttons from your Bitfocus Cloud account, or create a network of Companion installations
					that work together over the internet for remote production needs. Learn more in the{' '}
					<a
						target="_blank"
						rel="noreferrer"
						href="https://user.bitfocus.io/docs/companion-cloud"
						className="text-primary hover:underline font-medium"
					>
						Companion Cloud documentation
					</a>
					.
				</p>

				{cloudState ? (
					<CloudPageContent cloudState={cloudState} />
				) : (
					<LoadingRetryOrError dataReady={false} design="pulse" />
				)}
			</div>
		</div>
	)
}

function useCloudState() {
	const [cloudState, setCloudState] = useState<CloudControllerState | null>(null)

	useSubscription(
		trpc.cloud.watchState.subscriptionOptions(undefined, {
			onStarted: () => {
				console.log('Started cloud state subscription')
				setCloudState(null)
			},
			onData: (newState) => {
				setCloudState(newState)
			},
			onError: (err) => {
				console.error('Error in cloud state subscription', err)
				setCloudState(null)
			},
		})
	)

	return cloudState
}

function CloudPageContent({ cloudState }: { cloudState: CloudControllerState }) {
	return (
		<div className="space-y-4">
			{!!cloudState.error && <StaticAlert color="danger">{cloudState.error}</StaticAlert>}

			{!cloudState.authenticated ? (
				<CloudUserPass
					working={cloudState.authenticating}
					username={cloudState.authenticatedAs}
					onClearError={() => {
						// TODO: reimplement
					}}
				/>
			) : (
				<>
					<AuthState
						authenticatedAs={cloudState.authenticatedAs}
						cloudActive={cloudState.cloudActive}
						clearError={() => {
							// TODO: reimplement
						}}
					/>

					<RegionsList
						regionIds={cloudState.regions || []}
						cloudActive={cloudState.cloudActive}
						canActivate={cloudState.canActivate}
					/>

					<SecretKeyPanel uuid={cloudState.uuid} />
				</>
			)}
		</div>
	)
}

interface AuthStateProps {
	authenticatedAs: string | undefined
	cloudActive: boolean
	clearError: () => void
}

function AuthState({ authenticatedAs, cloudActive, clearError }: AuthStateProps) {
	const logoutMutation = useMutationExt(trpc.cloud.logout.mutationOptions())
	const userId = useId()

	return (
		<div className="surface-card p-4 flex items-center justify-between flex-wrap gap-3">
			<div className="flex items-center gap-3">
				<div className="w-10 h-10 rounded-lg bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0">
					<FontAwesomeIcon icon={faLock} />
				</div>
				<div>
					<FormLabel
						htmlFor={userId}
						className="text-xs font-semibold text-muted uppercase tracking-wider mb-0.5 block"
					>
						Authentication
					</FormLabel>
					<div id={userId} className="font-medium text-sm text-body">
						Logged in as <span className="font-semibold text-primary">{authenticatedAs}</span>
					</div>
				</div>
			</div>

			{!cloudActive && (
				<Button
					color="danger"
					size="sm"
					onClick={() => {
						clearError()
						logoutMutation.mutate()
					}}
				>
					Log out
				</Button>
			)}
		</div>
	)
}

interface RegionsListProps {
	regionIds: string[]
	cloudActive: boolean
	canActivate: boolean
}

function RegionsList({ regionIds, cloudActive, canActivate }: RegionsListProps) {
	const setCloudActiveMutation = useMutationExt(trpc.cloud.setCloudActive.mutationOptions())

	return (
		<div className="surface-card">
			<div className="p-4 border-b border-border/70 bg-surface-muted/30 flex items-center justify-between flex-wrap gap-2">
				<div className="flex items-center gap-2.5">
					<FontAwesomeIcon icon={faServer} className="text-muted text-sm" />
					<h5 className="text-sm font-bold text-body mb-0">Cloud Regions</h5>
				</div>

				<SwitchInputFieldWithLabel
					label="Activate Companion Cloud"
					disabled={!cloudActive && !canActivate}
					value={cloudActive}
					setValue={(val) => setCloudActiveMutation.mutate({ active: !!val })}
					small
					tooltip="Activate Companion Cloud"
				/>
			</div>

			<div className="p-4 space-y-3">
				{!cloudActive && (
					<p className="text-xs text-muted mb-3">
						Select the regions closest to you. Choose at least <strong>two regions</strong> for high-availability
						redundancy.
					</p>
				)}

				{cloudActive && (
					<Callout color="info" className="mb-3">
						Companion Cloud is currently activated. Deactivate above to change regions.
					</Callout>
				)}

				<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
					{regionIds.map((regionId) => (
						<CloudRegionPanel key={regionId} hideDisabled={cloudActive} regionId={regionId} />
					))}
				</div>
			</div>
		</div>
	)
}

const SecretKeyPanel = memo(function SecretKeyPanel({ uuid }: { uuid: string }) {
	const regenerateUUIDMutation = useMutationExt(trpc.cloud.regenerateUUID.mutationOptions())

	return (
		<div className="surface-card p-4 space-y-3">
			<div className="flex items-center gap-2.5">
				<FontAwesomeIcon icon={faKey} className="text-muted text-sm" />
				<h5 className="text-sm font-bold text-body mb-0">Super Secret Key</h5>
			</div>

			<p className="text-xs text-muted leading-relaxed mb-0">
				When connected to two or more regions, use this secret key in another Companion installation to remotely control
				this instance via the internet.
			</p>

			<div className="flex items-center gap-2 bg-surface-muted/60 p-2.5 rounded-lg border border-border/70">
				<code className="font-mono text-xs font-semibold text-body select-all flex-1 min-w-0 break-all">{uuid}</code>
				<CopyButton text={uuid} size="sm" color="secondary" />
			</div>

			<div className="pt-1">
				<Button color="secondary" size="sm" onClick={() => regenerateUUIDMutation.mutate()}>
					Regenerate Secret Key
				</Button>
			</div>
		</div>
	)
})
