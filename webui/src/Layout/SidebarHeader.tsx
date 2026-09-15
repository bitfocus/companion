import { faChevronLeft, faChevronRight, faLock, faXmark } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useSubscription } from '@trpc/tanstack-react-query'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { useContext, type MouseEventHandler } from 'react'
import { trpc } from '~/Resources/TRPC'
import { makeAbsolutePath } from '~/Resources/util'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { AdminLockContext } from './AdminLockContext.js'
import { useCompanionVersion } from './useCompanionVersion'

type UpdateChannel = 'stable' | 'beta' | 'experimental'

const CHANNEL_BADGE: Record<UpdateChannel, { label: string; className: string }> = {
	stable: { label: 'stable', className: 'bg-zinc-500/15 text-zinc-400' },
	beta: { label: 'beta', className: 'bg-amber-500/15 text-amber-500' },
	experimental: { label: 'experimental', className: 'bg-red-500/15 text-red-500' },
}

// The update server doesn't report a channel explicitly - infer it from the wording of its
// message, defaulting to 'stable' when there's no message (ie. nothing unusual to report).
function channelFromUpdateMessage(message: string | undefined): UpdateChannel {
	const lower = message?.toLowerCase() ?? ''
	if (lower.includes('experimental')) return 'experimental'
	if (lower.includes('beta')) return 'beta'
	return 'stable'
}

export function SidebarHeader(): React.JSX.Element {
	const { userConfig } = useContext(RootAppStoreContext)
	const installName = userConfig.properties?.installName

	return (
		<div className="sidebar-header brand py-2">
			<div className="sidebar-brand w-full">
				<div className="sidebar-brand-full w-full">
					<div className="flex items-center gap-1.5">
						<img src={makeAbsolutePath('/img/logo-glass.png')} style={{ height: 30 }} alt="logo" />
						<span>
							Bitfocus <span className="font-bold">Companion</span>
						</span>
					</div>
					{installName && installName.trim().length > 0 && (
						<div className="mt-2.5 flex items-center w-full">
							<div className="sidebar-install-name">
								<span className="truncate">{installName}</span>
							</div>
						</div>
					)}
				</div>
				<div className="sidebar-brand-narrow">
					<img src={makeAbsolutePath('/img/logo-glass.png')} style={{ height: 42 }} alt="logo" />
				</div>
			</div>
		</div>
	)
}

export interface SidebarFooterProps {
	onContextMenu: MouseEventHandler<HTMLElement>
	onToggleNarrow: () => void
	isNarrow: boolean
	mobileMode: boolean
	onCloseMobile: () => void
}

export const SidebarFooter = observer(function SidebarFooter({
	onContextMenu,
	onToggleNarrow,
	isNarrow,
	mobileMode,
	onCloseMobile,
}: SidebarFooterProps): React.JSX.Element {
	const { versionName } = useCompanionVersion()
	const { canLock, setLocked } = useContext(AdminLockContext)
	const updateData = useSubscription(trpc.appInfo.updateInfo.subscriptionOptions())

	const channelBadge = CHANNEL_BADGE[channelFromUpdateMessage(updateData.data?.message)]

	if (mobileMode) {
		return (
			<div className="sidebar-footer2 flex flex-col gap-2 p-3 border-t border-zinc-800/80 shrink-0">
				<button
					type="button"
					className="w-full h-9 flex items-center justify-center gap-2 bg-zinc-800/60 hover:bg-zinc-700/80 border border-zinc-700/50 rounded-md text-xs font-medium text-zinc-200 hover:text-white transition cursor-pointer shadow-xs"
					onClick={onCloseMobile}
					title="Close navigation"
				>
					<FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5 text-zinc-400" />
					<span>Close navigation</span>
				</button>
			</div>
		)
	}

	if (isNarrow) {
		return (
			<div className="sidebar-footer2 flex flex-col items-center gap-2 p-2 border-t border-zinc-800/80 shrink-0">
				{canLock && (
					<button
						type="button"
						className="w-9 h-9 flex items-center justify-center bg-zinc-800/60 hover:bg-zinc-700/80 border border-zinc-700/50 rounded-md text-zinc-300 hover:text-white transition cursor-pointer shadow-sm"
						onClick={setLocked}
						title="Lock Admin UI"
					>
						<FontAwesomeIcon icon={faLock} className="w-3.5 h-3.5 text-zinc-400" />
					</button>
				)}
				<button
					type="button"
					className="w-9 h-9 flex items-center justify-center bg-zinc-800/60 hover:bg-zinc-700/80 border border-zinc-700/50 rounded-md text-zinc-300 hover:text-white transition cursor-pointer shadow-sm"
					onClick={onToggleNarrow}
					onContextMenu={onContextMenu}
					title="Expand Sidebar"
				>
					<FontAwesomeIcon icon={faChevronRight} className="w-3.5 h-3.5 text-zinc-400" />
				</button>
			</div>
		)
	}

	return (
		<div className="sidebar-footer2 flex flex-col gap-2 p-3 border-t border-zinc-800/80 shrink-0">
			{/* Row 1: Full-width Version (Bigger) & Update Channel Tag */}
			<div className="flex items-center justify-between gap-2 w-full min-w-0">
				<span className="version font-bold text-sm text-zinc-100 truncate">{versionName || 'Unknown'}</span>
				<a
					className={classNames(
						'inline-block px-2 py-0.5 text-3xs font-bold uppercase rounded-full truncate shrink-0',
						channelBadge.className,
						updateData.data?.message && 'hover:opacity-80'
					)}
					target={updateData.data?.message ? '_blank' : undefined}
					href={updateData.data?.message ? updateData.data.link || 'https://companion.free/' : undefined}
					rel="noopener noreferrer"
					title={updateData.data?.message}
				>
					{channelBadge.label}
				</a>
			</div>

			{/* Row 2: Lock Admin UI Button (when lockout enabled) */}
			{canLock && (
				<button
					type="button"
					className="w-full h-7 flex items-center justify-center gap-1.5 bg-zinc-800/60 hover:bg-zinc-700/80 border border-zinc-700/50 rounded-md text-xs font-medium text-zinc-300 hover:text-white transition cursor-pointer shadow-xs"
					onClick={setLocked}
					title="Lock Admin UI"
				>
					<FontAwesomeIcon icon={faLock} className="w-3 h-3 text-zinc-400" />
					<span>Lock Admin UI</span>
				</button>
			)}

			{/* Row 3: Sidebar Collapse Button */}
			<button
				type="button"
				className="w-full h-7 flex items-center justify-center gap-1.5 bg-zinc-800/60 hover:bg-zinc-700/80 border border-zinc-700/50 rounded-md text-xs font-medium text-zinc-300 hover:text-white transition cursor-pointer shadow-xs"
				onClick={onToggleNarrow}
				onContextMenu={onContextMenu}
				title="Collapse Sidebar"
			>
				<FontAwesomeIcon icon={faChevronLeft} className="w-3 h-3 text-zinc-400" />
				<span>Collapse Sidebar</span>
			</button>
		</div>
	)
})
