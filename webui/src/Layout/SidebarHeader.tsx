import { faChevronLeft, faChevronRight, faXmark } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import type { MouseEventHandler } from 'react'
import { Button } from '~/Components/Button.js'
import '~/Components/LogoMark.css'
import { makeAbsolutePath } from '~/Resources/util'
import { CHANNEL_BADGE, channelFromVersionBuild } from './updateChannel.js'
import { useCompanionVersion } from './useCompanionVersion'

export function SidebarHeader(): React.JSX.Element {
	return (
		<div className="sidebar-header brand py-2">
			<div className="sidebar-brand w-full">
				<div className="sidebar-brand-full w-full">
					<div className="flex items-center justify-center gap-1.5">
						<span className="logo-mark sidebar-logo-mark">
							<img src={makeAbsolutePath('/img/logo-glass.png')} alt="Bitfocus Companion" />
						</span>
						<span>
							Bitfocus <span className="font-bold">Companion</span>
						</span>
					</div>
				</div>
				<div className="sidebar-brand-narrow">
					<span className="logo-mark sidebar-logo-mark sidebar-logo-mark-narrow">
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
	const channel = channelFromVersionBuild(versionBuild)
	const channelBadge = CHANNEL_BADGE[channel]

	if (mobileMode) {
		return (
			<div className="sidebar-footer2 flex flex-col gap-2 p-3 border-t border-border/80 shrink-0">
				<Button
					variant="outline"
					size="sm"
					className="w-full h-9 inline-flex items-center justify-center gap-2"
					onClick={onCloseMobile}
					title="Close navigation"
				>
					<FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5 text-muted" />
					<span>Close navigation</span>
				</Button>
			</div>
		)
	}

	if (compact) {
		const handleExpand = isNarrow ? onToggleNarrow : onToggleFolding

		return (
			<div className="sidebar-footer2 flex flex-col items-center gap-2 p-2 border-t border-border/80 shrink-0">
				<Button
					variant="outline"
					size="sm"
					className="w-9 h-9 inline-flex items-center justify-center"
					onClick={handleExpand}
					onContextMenu={onContextMenu}
					title="Expand Sidebar"
				>
					<FontAwesomeIcon icon={faChevronRight} className="w-3.5 h-3.5 text-muted" />
				</Button>
			</div>
		)
	}

	return (
		<div className="sidebar-footer2 sidebar-footer-full flex flex-col gap-2 p-3 border-t border-border/80 shrink-0">
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

			{/* Row 2: Sidebar Folding Button */}
			<Button
				variant="outline"
				size="sm"
				className="w-full h-7 inline-flex items-center justify-center gap-1.5"
				onClick={onToggleFolding}
				onContextMenu={onContextMenu}
				title={folding ? 'Keep Sidebar Open' : 'Collapse Sidebar'}
			>
				<FontAwesomeIcon icon={folding ? faChevronRight : faChevronLeft} className="w-3 h-3 text-muted" />
				<span>{folding ? 'Keep Sidebar Open' : 'Collapse Sidebar'}</span>
			</Button>
		</div>
	)
})
