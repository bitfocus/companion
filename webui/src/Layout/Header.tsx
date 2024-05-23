import React, { useContext, useEffect, useState } from 'react'
import { CHeader, CHeaderBrand, CHeaderNavItem, CHeaderNav, CHeaderNavLink, CToggler } from '@coreui/react'
import { socketEmitPromise } from '../util.js'
import { faLock } from '@fortawesome/free-solid-svg-icons'
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

	const versionString = versionInfo ? `${versionInfo.appVersion} (${versionInfo.appBuild})` : '?'

	return (
		<CHeader colorScheme="dark">
			<CToggler inHeader onClick={toggleSidebar} />
			<CHeaderBrand className="d-lg-none">
				Bitfocus&nbsp;<span style={{ fontWeight: 'bold' }}>Companion</span>
			</CHeaderBrand>

			<CHeaderNav className="d-md-down-none">
				{userConfig.properties?.installName && userConfig.properties?.installName.length > 0 && (
					<CHeaderNavItem className="install-name">{userConfig.properties?.installName}:</CHeaderNavItem>
				)}

				<CHeaderNavItem>
					<CHeaderNavLink target="_new" title="Version Number" href="https://bitfocus.io/companion/">
						{versionString}
					</CHeaderNavLink>
				</CHeaderNavItem>

				<CHeaderNavItem>
					<CHeaderNavLink target="_new" href={updateData?.link || 'https://bitfocus.io/companion/'}>
						{updateData?.message || ''}
					</CHeaderNavLink>
				</CHeaderNavItem>
			</CHeaderNav>

			{canLock && (
				<CHeaderNav className="ml-auto header-right">
					<CHeaderNavItem>
						<CHeaderNavLink onClick={setLocked} title="Lock Admin UI">
							<FontAwesomeIcon icon={faLock} />
						</CHeaderNavLink>
					</CHeaderNavItem>
				</CHeaderNav>
			)}
		</CHeader>
	)
})
