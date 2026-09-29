import {
	faChevronLeft,
	faChevronRight,
	faExternalLinkSquare,
	faLock,
	faTriangleExclamation,
	faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useSubscription } from '@trpc/tanstack-react-query'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { useContext, type MouseEventHandler } from 'react'
import { trpc } from '~/Resources/TRPC'
import { makeAbsolutePath } from '~/Resources/util'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { AdminLockContext } from './AdminLockContext.js'
import { CHANNEL_BADGE, channelFromVersionBuild } from './updateChannel.js'
import { useCompanionVersion } from './useCompanionVersion'

interface UpdateNoticeProps {
	updateInfo: { message: string; message2?: string; link?: string }
	compact: boolean
}

// Notice from the update server (typically "a new version is available"). Shown in the sidebar
// footer since the app no longer has a persistent header to put it in.
function UpdateNotice({ updateInfo, compact }: UpdateNoticeProps): React.JSX.Element {
	const href = updateInfo.link || 'https://companion.free/'

	if (compact) {
		return (
			<a
				className="sidebar-update-notice sidebar-update-notice-compact"
				target="_blank"
				href={href}
				rel="noopener noreferrer"
				title={[updateInfo.message, updateInfo.message2].filter(Boolean).join('\n')}
			>
				<FontAwesomeIcon icon={faTriangleExclamation} className="w-3.5 h-3.5" />
				<span className="sidebar-update-notice-dot" />
			</a>
		)
	}

	return (
		<a className="sidebar-update-notice" target="_blank" href={href} rel="noopener noreferrer">
			<FontAwesomeIcon icon={faTriangleExclamation} className="w-3.5 h-3.5 shrink-0" />
			<span className="min-w-0 flex-1">
				<span className="block">{updateInfo.message}</span>
				{!!updateInfo.message2 && <span className="block">{updateInfo.message2}</span>}
			</span>
			<FontAwesomeIcon icon={faExternalLinkSquare} className="w-3 h-3 shrink-0 opacity-70" />
		</a>
	)
}

export function SidebarHeader(): React.JSX.Element {
	const { userConfig } = useContext(RootAppStoreContext)
	const installName = userConfig.properties?.installName

	return (
		<div className="sidebar-header brand py-2">
			<div className="sidebar-brand w-full">
				<div className="sidebar-brand-full w-full">
					<div className="flex items-center justify-center gap-1.5">
						<span className="sidebar-logo-mark">
							<img src={makeAbsolutePath('/img/logo-glass.png')} alt="Bitfocus Companion" />
						</span>
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
					<span className="sidebar-logo-mark sidebar-logo-mark-narrow">
						<img src={makeAbsolutePath('/img/logo-glass.png')} alt="Bitfocus Companion" />
					</span>
				</div>
			</div>
		</div>
	)
}

export interface SidebarFooterProps {
	onContextMenu: MouseEventHandler<HTMLElement>
	onToggleFolding: () => void
	folding: boolean
	onToggleNarrow: () => void
	isNarrow: boolean
	compact: boolean
	mobileMode: boolean
	onCloseMobile: () => void
}

export const SidebarFooter = observer(function SidebarFooter({
	onContextMenu,
	onToggleFolding,
	folding,
	onToggleNarrow,
	isNarrow,
	compact,
	mobileMode,
	onCloseMobile,
}: SidebarFooterProps): React.JSX.Element {
	const { versionName, versionBuild } = useCompanionVersion()
	const { canLock, setLocked } = useContext(AdminLockContext)
	const channel = channelFromVersionBuild(versionBuild)
	const channelBadge = CHANNEL_BADGE[channel]

	// The update server only knows about released versions, so its "new version available" notice is
	// noise on an experimental (main/feature branch) build.
	const updateData = useSubscription(trpc.appInfo.updateInfo.subscriptionOptions())
	const updateInfo = updateData.data?.message && channel !== 'experimental' ? updateData.data : null

	if (mobileMode) {
		return (
			<div className="sidebar-footer2 flex flex-col gap-2 p-3 border-t border-border/80 shrink-0">
				{updateInfo && <UpdateNotice updateInfo={updateInfo} compact={false} />}
				<button
					type="button"
					className="w-full h-9 flex items-center justify-center gap-2 bg-surface hover:bg-surface-hover border border-border rounded-md text-xs font-medium text-muted hover:text-body transition cursor-pointer shadow-xs"
					onClick={onCloseMobile}
					title="Close navigation"
				>
					<FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5 text-muted" />
					<span>Close navigation</span>
				</button>
			</div>
		)
	}

	if (compact) {
		const handleExpand = isNarrow ? onToggleNarrow : onToggleFolding

		return (
			<div className="sidebar-footer2 flex flex-col items-center gap-2 p-2 border-t border-border/80 shrink-0">
				{updateInfo && <UpdateNotice updateInfo={updateInfo} compact={true} />}
				{canLock && (
					<button
						type="button"
						className="w-9 h-9 flex items-center justify-center bg-surface hover:bg-surface-hover border border-border rounded-md text-muted hover:text-body transition cursor-pointer shadow-sm"
						onClick={setLocked}
						title="Lock Admin UI"
					>
						<FontAwesomeIcon icon={faLock} className="w-3.5 h-3.5 text-muted" />
					</button>
				)}
				<button
					type="button"
					className="w-9 h-9 flex items-center justify-center bg-surface hover:bg-surface-hover border border-border rounded-md text-muted hover:text-body transition cursor-pointer shadow-sm"
					onClick={handleExpand}
					onContextMenu={onContextMenu}
					title="Expand Sidebar"
				>
					<FontAwesomeIcon icon={faChevronRight} className="w-3.5 h-3.5 text-muted" />
				</button>
			</div>
		)
	}

	return (
		<div className="sidebar-footer2 flex flex-col gap-2 p-3 border-t border-border/80 shrink-0">
			{updateInfo && <UpdateNotice updateInfo={updateInfo} compact={false} />}

			{/* Row 1: Full-width Version (Bigger) & Update Channel Tag */}
			<div className="flex items-center justify-between gap-2 w-full min-w-0">
				<span className="version font-bold text-sm text-body truncate" title={versionBuild || undefined}>
					{versionName || 'Unknown'}
				</span>
				<span
					className={classNames(
						'inline-block px-2 py-0.5 text-3xs font-bold uppercase rounded-full truncate shrink-0',
						channelBadge.className
					)}
				>
					{channelBadge.label}
				</span>
			</div>

			{/* Row 2: Lock Admin UI Button (when lockout enabled) */}
			{canLock && (
				<button
					type="button"
					className="w-full h-7 flex items-center justify-center gap-1.5 bg-surface hover:bg-surface-hover border border-border rounded-md text-xs font-medium text-muted hover:text-body transition cursor-pointer shadow-xs"
					onClick={setLocked}
					title="Lock Admin UI"
				>
					<FontAwesomeIcon icon={faLock} className="w-3 h-3 text-muted" />
					<span>Lock Admin UI</span>
				</button>
			)}

			{/* Row 3: Sidebar Folding Button */}
			<button
				type="button"
				className="w-full h-7 flex items-center justify-center gap-1.5 bg-surface hover:bg-surface-hover border border-border rounded-md text-xs font-medium text-muted hover:text-body transition cursor-pointer shadow-xs"
				onClick={onToggleFolding}
				onContextMenu={onContextMenu}
				title={folding ? 'Keep Sidebar Open' : 'Collapse Sidebar'}
			>
				<FontAwesomeIcon icon={folding ? faChevronRight : faChevronLeft} className="w-3 h-3 text-muted" />
				<span>{folding ? 'Keep Sidebar Open' : 'Collapse Sidebar'}</span>
			</button>
		</div>
	)
})
