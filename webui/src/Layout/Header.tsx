import React, { useContext, useEffect, useState } from 'react'
import { CHeader, CHeaderBrand, CHeaderNav, CNavItem, CNavLink, CHeaderToggler, CContainer } from '@coreui/react'
import { socketEmitPromise } from '../util.js'
import { faBars, faLock, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { AppUpdateInfo, AppVersionInfo } from '@companion-app/shared/Model/Common.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'

interface MyHeaderProps {
	toggleSidebar: () => void
	canLock: boolean
	setLocked: (locked: boolean) => void
}

export const MyHeader = observer(function MyHeader({ toggleSidebar, canLock, setLocked }: MyHeaderProps) {
	const { socket, userConfig } = useContext(RootAppStoreContext)

	const [versionInfo, setVersionInfo] = useState<AppVersionInfo | null>(null)
	const [updateData, setUpdateData] = useState<AppUpdateInfo | null>(null)

	useEffect(() => {
		if (!socket) return

		socket.on('app-update-info', setUpdateData)
		socket.emit('app-update-info')

		socketEmitPromise(socket, 'app-version-info', [])
			.then((info) => {
				setVersionInfo(info)
			})
			.catch((e) => {
				console.error('Failed to load version info', e)
			})

		return () => {
			socket.off('app-update-info', setUpdateData)
		}
	}, [socket])

	const versionString = versionInfo
		? versionInfo.appBuild.includes('stable')
			? `v${versionInfo.appVersion}`
			: `v${versionInfo.appBuild}`
		: ''
	const buildString = versionInfo ? `Build ${versionInfo.appBuild}` : ''

	return (
		<CHeader position="sticky" className="p-0">
			<CContainer fluid>
				<CHeaderToggler className="ps-1" onClick={toggleSidebar}>
					<FontAwesomeIcon icon={faBars} />
				</CHeaderToggler>
				<CHeaderBrand className="mx-auto d-md-none">
					Bitfocus&nbsp;<span style={{ fontWeight: 'bold' }}>Companion</span>
				</CHeaderBrand>

				<CHeaderNav className="d-none d-md-flex me-auto">
					{userConfig.properties?.installName && userConfig.properties?.installName.length > 0 && (
						<CNavItem className="install-name">{userConfig.properties?.installName}</CNavItem>
					)}

					<CNavItem>
						<CNavLink target="_new" title={buildString} href="https://bitfocus.io/companion/">
							{versionString}
						</CNavLink>
					</CNavItem>

					{updateData?.message ? (
						<CNavItem className="header-update-warn">
							<CNavLink target="_new" href={updateData?.link || 'https://bitfocus.io/companion/'}>
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
