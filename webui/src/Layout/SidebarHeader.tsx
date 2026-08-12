import { faCog } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import type { MouseEventHandler } from 'react'
import { makeAbsolutePath } from '~/Resources/util'
import { useSidebarState } from './Sidebar'
import { useCompanionVersion } from './useCompanionVersion'

export function SidebarHeader(): React.JSX.Element {
	return (
		<div className="sidebar-header brand">
			<div className="sidebar-brand">
				<div className="sidebar-brand-full">
					<img src={makeAbsolutePath('/img/icons/48x48.png')} style={{ height: 30 }} alt="logo" />
					&nbsp; Bitfocus&nbsp;
					<span style={{ fontWeight: 'bold' }}>Companion</span>
				</div>
				<div className="sidebar-brand-narrow">
					<img src={makeAbsolutePath('/img/icons/48x48.png')} style={{ height: 42 }} alt="logo" />
				</div>
			</div>
		</div>
	)
}

export interface SidebarFooterProps {
	onContextMenu: MouseEventHandler<HTMLDivElement>
}

export const SidebarFooter = observer(function SidebarFooter({ onContextMenu }: SidebarFooterProps): React.JSX.Element {
	const { versionName, versionBuild: versionSubheading } = useCompanionVersion()
	const { mobileMode } = useSidebarState()

	return (
		<div className="sidebar-footer2 cui-d-flex">
			<div className="nav-link sidebar-footer-toggler">
				{mobileMode ? (
					<span className={'nav-icon-wrapper cui-d-flex block-collapse'} onMouseUp={onContextMenu}>
						<FontAwesomeIcon className="nav-icon cui-opacity-50" icon={faCog} />
					</span>
				) : (
					<span
						className={classNames('nav-icon-wrapper', mobileMode ? 'cui-d-none' : 'cui-d-flex')}
						onClick={onContextMenu}
						onContextMenu={onContextMenu}
						title="Click for more sidebar options"
					>
						<span className="nav-icon sidebar-toggler"></span>
					</span>
				)}

				<span className="cui-flex-fill truncate">
					<span className="version">{versionName || 'Unknown'}</span>
					{/* <br /> */}
					<span className="version-sub">{versionSubheading}</span>
				</span>
			</div>
		</div>
	)
})
