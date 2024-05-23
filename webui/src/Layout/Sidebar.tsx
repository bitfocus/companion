import React, { memo, useCallback, useState } from 'react'
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
	sidebarShow: boolean
	showWizard: () => void
}

export const MySidebar = memo(function MySidebar({ sidebarShow, showWizard }: MySidebarProps) {
	const [unfoldable, setUnfoldable] = useState(false)

	const showWizard2 = useCallback(
		(e: React.MouseEvent<HTMLElement>) => {
			e.preventDefault()

			showWizard()
		},
		[showWizard]
	)

	return (
		<CSidebar position="fixed" unfoldable={unfoldable} visible={sidebarShow}>
			<CSidebarBrand>
				<div className="sidebar-brand-full">
					<img src="/img/icons/48x48.png" height="30" alt="logo" />
					&nbsp; Bitfocus&nbsp;
					<span style={{ fontWeight: 'bold' }}>Companion</span>
				</div>
				<div className="sidebar-brand-narrow">
					<img src="/img/icons/48x48.png" height="42px" alt="logo" />
				</div>
			</CSidebarBrand>
			<CSidebarNav>
				<CNavItem href="#" onClick={showWizard2}>
					<FontAwesomeIcon className="nav-icon" icon={faHatWizard} /> Configuration Wizard
				</CNavItem>
				<CNavItem target="_new" href="/emulators">
					<FontAwesomeIcon className="nav-icon" icon={faGamepad} /> Emulator
				</CNavItem>

				<CNavItem target="_new" href="/tablet">
					<FontAwesomeIcon className="nav-icon" icon={faTabletAlt} /> Web buttons
				</CNavItem>

				<CNavItem target="_new" href="https://github.com/bitfocus/companion/issues">
					<FontAwesomeIcon className="nav-icon" icon={faBug} /> Bugs & Features
				</CNavItem>
				<CNavItem target="_new" href="https://www.facebook.com/groups/companion/">
					<FontAwesomeIcon className="nav-icon" icon={faUsers} /> Facebook
				</CNavItem>
				<CNavItem target="_new" href="https://bitfocus.io/api/slackinvite">
					<FontAwesomeIcon className="nav-icon" icon={faComments} /> Slack Chat
				</CNavItem>
				<CNavItem target="_new" href="https://donorbox.org/bitfocus-opensource">
					<FontAwesomeIcon className="nav-icon" icon={faDollarSign} /> Donate
				</CNavItem>

				<CNavItem target="_new" href="/getting-started">
					<FontAwesomeIcon className="nav-icon" icon={faInfo} /> Getting Started
				</CNavItem>
			</CSidebarNav>
			<CSidebarToggler className="d-none d-lg-flex" onClick={() => setUnfoldable((val) => !val)} />
		</CSidebar>
	)
})
