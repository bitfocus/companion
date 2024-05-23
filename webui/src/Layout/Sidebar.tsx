import React, { memo } from 'react'
import { CSidebar, CSidebarNav, CNavItem, CSidebarBrand, CSidebarToggler } from '@coreui/react'
import {
	faBug,
	faComments,
	faDollarSign,
	faGamepad,
	faHatWizard,
	faInfo,
	faTabletAlt,
	faUsers,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

interface MySidebarProps {
	show: boolean
	showWizard: () => void
}

export const MySidebar = memo(function MySidebar({ show, showWizard }: MySidebarProps) {
	return (
		<CSidebar visible={show}>
			<CSidebarNav>
				<CSidebarBrand>
					<div className="c-sidebar-brand-full">
						<img src="/img/icons/48x48.png" height="30" alt="logo" />
						&nbsp; Bitfocus&nbsp;
						<span style={{ fontWeight: 'bold' }}>Companion</span>
					</div>
					<div className="c-sidebar-brand-minimized">
						<img src="/img/icons/48x48.png" height="42px" alt="logo" />
					</div>
				</CSidebarBrand>

				<CNavItem onClick={showWizard}>
					<FontAwesomeIcon className="c-sidebar-nav-icon" icon={faHatWizard} /> Configuration Wizard
				</CNavItem>
				<CNavItem target="_new" href="/emulators">
					<FontAwesomeIcon className="c-sidebar-nav-icon" icon={faGamepad} /> Emulator
				</CNavItem>

				<CNavItem target="_new" href="/tablet">
					<FontAwesomeIcon className="c-sidebar-nav-icon" icon={faTabletAlt} /> Web buttons
				</CNavItem>

				<CNavItem target="_new" href="https://github.com/bitfocus/companion/issues">
					<FontAwesomeIcon className="c-sidebar-nav-icon" icon={faBug} /> Bugs & Features
				</CNavItem>
				<CNavItem target="_new" href="https://www.facebook.com/groups/companion/">
					<FontAwesomeIcon className="c-sidebar-nav-icon" icon={faUsers} /> Facebook
				</CNavItem>
				<CNavItem target="_new" href="https://bitfocus.io/api/slackinvite">
					<FontAwesomeIcon className="c-sidebar-nav-icon" icon={faComments} /> Slack Chat
				</CNavItem>
				<CNavItem target="_new" href="https://donorbox.org/bitfocus-opensource">
					<FontAwesomeIcon className="c-sidebar-nav-icon" icon={faDollarSign} /> Donate
				</CNavItem>

				<CNavItem target="_new" href="/getting-started">
					<FontAwesomeIcon className="c-sidebar-nav-icon" icon={faInfo} /> Getting Started
				</CNavItem>
			</CSidebarNav>
			<CSidebarToggler />
		</CSidebar>
	)
})
