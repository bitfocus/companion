import React, { memo, useCallback, useState } from 'react'
import { useLocation, NavLink } from 'react-router-dom'
import { CSidebar, CSidebarNav, CNavItem, CNavLink, CSidebarBrand, CSidebarToggler, CSidebarHeader } from '@coreui/react'
import {
	faFileImport,
	faCog,
	faClipboardList,
	faCloud,
	faTh,
	faClock,
	faPlug,
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
import { SURFACES_PAGE_PREFIX } from '../Surfaces/index.js'
import { BUTTONS_PAGE_PREFIX } from '../Buttons/index.js'
import { TRIGGERS_PAGE_PREFIX } from '../Triggers/index.js'

interface MySidebarProps {
	sidebarShow: boolean
	showWizard: () => void
}

const navItems = [
	{ name: 'Connections', icon: faPlug, path: '/connections' },
	{ name: 'Buttons', icon: faTh, path: BUTTONS_PAGE_PREFIX },
	{ name: 'Surfaces', icon: faGamepad, path: SURFACES_PAGE_PREFIX },
	{ name: 'Triggers', icon: faClock, path: TRIGGERS_PAGE_PREFIX },
	{ name: 'Variables', icon: faDollarSign, path: '/variables' },
	{ name: 'Settings', icon: faCog, path: '/settings' },
	{ name: 'Import / Export', icon: faFileImport, path: '/import-export' },
	{ name: 'Log', icon: faClipboardList, path: '/log' },
	{ name: 'Cloud', icon: faCloud, path: '/cloud', show: window.localStorage.getItem('show_companion_cloud') === '1' },
]

export const MySidebar = memo(function MySidebar({ sidebarShow, showWizard }: MySidebarProps) {
	const [unfoldable, setUnfoldable] = useState(false)

	const routerLocation = useLocation()

	const isActive = (prefix: string) => routerLocation.pathname.startsWith(prefix + '/') || routerLocation.pathname === prefix

	const showWizard2 = useCallback(
		(e: React.MouseEvent<HTMLElement>) => {
			e.preventDefault()

			showWizard()
		},
		[showWizard]
	)

	return (
		<CSidebar position="fixed" unfoldable={unfoldable} visible={sidebarShow} colorScheme="dark">
			<CSidebarHeader className="brand">
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
			</CSidebarHeader>
			<CSidebarNav>
				{navItems.filter((item) => item.show !== false).map((item) => (
					<CNavItem key={item.path}>
						<CNavLink to={item.path} active={isActive(item.path)} as={NavLink}>
							<FontAwesomeIcon className="nav-icon" icon={item.icon} /> {item.name}
						</CNavLink>
					</CNavItem>
				))}
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
			<CSidebarHeader className="border-top">
				<CSidebarToggler className="d-none d-lg-flex" onClick={() => setUnfoldable((val) => !val)} />
			</CSidebarHeader>
		</CSidebar>
	)
})
