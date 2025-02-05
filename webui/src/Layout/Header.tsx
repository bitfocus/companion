import React, { useContext, useEffect, useState } from 'react'
import {
	CHeader,
	CHeaderBrand,
	CHeaderNav,
	CNavItem,
	CNavLink,
	CHeaderToggler,
	CContainer,
	CSpinner,
} from '@coreui/react'
import { faBars, faLock, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { AppUpdateInfo } from '@companion-app/shared/Model/Common.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { useSidebarState } from './Sidebar.js'
import { trpc } from '../TRPC.js'

interface MyHeaderProps {
	canLock: boolean
	setLocked: (locked: boolean) => void
}

export const MyHeader = observer(function MyHeader({ canLock, setLocked }: MyHeaderProps) {
	const { socket, userConfig } = useContext(RootAppStoreContext)

	const { showToggle, clickToggle } = useSidebarState()

	const [updateData, setUpdateData] = useState<AppUpdateInfo | null>(null)

	useEffect(() => {
		if (!socket) return

		const unsubAppInfo = socket.on('app-update-info', setUpdateData)
		socket.emit('app-update-info')

		return () => {
			unsubAppInfo()
		}
	}, [socket])

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

					<HeaderVersion />

					{updateData?.message ? (
						<CNavItem className="header-update-warn">
							<CNavLink target="_blank" href={updateData?.link || 'https://bitfocus.io/companion/'}>
								<FontAwesomeIcon icon={faTriangleExclamation} className="header-update-icon" />
								{updateData.message}
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

function HeaderVersion() {
	const versionInfo = trpc.appInfo.version.useQuery()

	const versionString = versionInfo.data
		? versionInfo.data.appBuild.includes('stable')
			? `v${versionInfo.data.appVersion}`
			: `v${versionInfo.data.appBuild}`
		: ''
	const buildString = versionInfo.data ? `Build ${versionInfo.data.appBuild}` : ''

	return (
		<CNavItem>
			{versionInfo.isLoading ? <CSpinner color="white" /> : null}
			{versionInfo.data ? (
				<CNavLink target="_blank" title={buildString} href="https://bitfocus.io/companion/">
					{versionString}
				</CNavLink>
			) : null}
		</CNavItem>
	)
}
