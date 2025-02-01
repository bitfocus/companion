import React, { memo, useCallback, useContext, useState } from 'react'
import { CSidebar, CSidebarNav, CNavItem, CSidebarBrand, CSidebarToggler, CSidebarHeader } from '@coreui/react'
import {
	faBug,
	faComments,
	faDollarSign,
	faGamepad,
	faHatWizard,
	faInfo,
	faTabletAlt,
	faUsers,
	faStar,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'

interface MySidebarProps {
	sidebarShow: boolean
	showWizard: () => void
}

export const MySidebar = memo(function MySidebar({ sidebarShow, showWizard }: MySidebarProps) {
	const { whatsNewModal } = useContext(RootAppStoreContext)

	const [unfoldable, setUnfoldable] = useState(false)

	const showWizard2 = useCallback(
		(e: React.MouseEvent<HTMLElement>) => {
			e.preventDefault()

			showWizard()
		},
		[showWizard]
	)

	const whatsNewOpen = useCallback(() => whatsNewModal.current?.show(), [])

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
				<CNavItem href="#" onClick={showWizard2}>
					<FontAwesomeIcon className="nav-icon" icon={faHatWizard} /> Configuration Wizard
				</CNavItem>
				<CNavItem target="_new" href="/emulators">
					<FontAwesomeIcon className="nav-icon" icon={faGamepad} /> Emulator
				</CNavItem>

				<CNavItem target="_new" href="/tablet">
					<FontAwesomeIcon className="nav-icon" icon={faTabletAlt} /> Web buttons
				</CNavItem>

				<CNavItem target="_new" href="https://bfoc.us/fiobkz0yqs">
					<FontAwesomeIcon className="nav-icon" icon={faBug} /> Bugs & Features
				</CNavItem>
				<CNavItem target="_new" href="https://bfoc.us/qjk0reeqmy">
					<FontAwesomeIcon className="nav-icon" icon={faUsers} /> Community Forum
				</CNavItem>
				<CNavItem target="_new" href="https://bfoc.us/ke7e9dqgaz">
					<FontAwesomeIcon className="nav-icon" icon={faComments} /> Slack Chat
				</CNavItem>
				<CNavItem target="_new" href="https://bfoc.us/ccfbf8wm2x">
					<FontAwesomeIcon className="nav-icon" icon={faDollarSign} /> Donate
				</CNavItem>

				<CNavItem target="_new" href="/getting-started">
					<FontAwesomeIcon className="nav-icon" icon={faInfo} /> Getting Started
				</CNavItem>
				<CNavItem href="#" onClick={whatsNewOpen}>
					<FontAwesomeIcon className="nav-icon" icon={faStar} /> What's New
				</CNavItem>
			</CSidebarNav>
			<CSidebarHeader className="border-top">
				<CSidebarToggler className="d-none d-lg-flex" onClick={() => setUnfoldable((val) => !val)} />
			</CSidebarHeader>
		</CSidebar>
	)
})
