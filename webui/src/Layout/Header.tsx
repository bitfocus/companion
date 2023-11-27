import React, { useContext, useEffect, useState } from 'react'
import { CHeader, CHeaderBrand, CHeaderNavItem, CHeaderNav, CHeaderNavLink, CToggler } from '@coreui/react'
import { SocketContext, socketEmitPromise } from '../util.js'
import { faLock } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { AppUpdateInfo, AppVersionInfo } from '@companion/shared/Model/Common.js'

interface MyHeaderProps {
	toggleSidebar: () => void
	canLock: boolean
	setLocked: (locked: boolean) => void
}

export function MyHeader({ toggleSidebar, canLock, setLocked }: MyHeaderProps) {
	const socket = useContext(SocketContext)

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
}
