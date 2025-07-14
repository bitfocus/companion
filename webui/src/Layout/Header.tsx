import React, { useContext } from 'react'
import { CHeader, CHeaderBrand, CHeaderNav, CNavItem, CNavLink, CHeaderToggler, CContainer } from '@coreui/react'
import { faBars, faLock, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { useSidebarState } from './Sidebar.js'
import { trpc } from '../TRPC.js'
import { useSubscription } from '@trpc/tanstack-react-query'

interface MyHeaderProps {
	canLock: boolean
	setLocked: (locked: boolean) => void
}

export const MyHeader = observer(function MyHeader({ canLock, setLocked }: MyHeaderProps) {
	const { userConfig } = useContext(RootAppStoreContext)

	const { showToggle, clickToggle } = useSidebarState()

	const updateData = useSubscription(trpc.appInfo.updateInfo.subscriptionOptions())

	return (
		<CHeader position="sticky" className="p-0">
			<CContainer fluid>
				{showToggle && (
					<CHeaderToggler className="ps-1" onClick={clickToggle}>
						<FontAwesomeIcon icon={faBars} />
					</CHeaderToggler>
				)}
				<CHeaderBrand className="mx-auto d-md-none">
					Bitfocus&nbsp;<span style={{ fontWeight: 'bold' }}>Companion</span>
				</CHeaderBrand>

				<CHeaderNav className="d-none d-md-flex me-auto">
					{userConfig.properties?.installName && userConfig.properties?.installName.length > 0 && (
						<CNavItem className="install-name">{userConfig.properties?.installName}</CNavItem>
					)}

					{updateData.data ? (
						<CNavItem className="header-update-warn">
							<CNavLink target="_blank" href={updateData.data.link || 'https://bitfocus.io/companion/'}>
								<FontAwesomeIcon icon={faTriangleExclamation} className="header-update-icon" />
								{updateData.data.message}
							</CNavLink>
						</CNavItem>
					) : (
						''
					)}
				</CHeaderNav>

				{canLock && (
					<CHeaderNav className="ml-auto header-right">
						<CNavItem>
							<CNavLink onClick={() => setLocked(true)} title="Lock Admin UI">
								<FontAwesomeIcon icon={faLock} />
							</CNavLink>
						</CNavItem>
					</CHeaderNav>
				)}
			</CContainer>
		</CHeader>
	)
})
