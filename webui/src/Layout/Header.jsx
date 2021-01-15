import React, { useContext, useEffect, useState } from 'react'
import { CHeader, CHeaderBrand, CHeaderNavItem, CHeaderNav, CHeaderNavLink } from '@coreui/react'
import { CompanionContext } from '../util'

export function MyHeader() {
	const context = useContext(CompanionContext)

	const [versionInfo, setVersionInfo] = useState(null)
	const [updateData, setUpdateData] = useState(null)

	useEffect(() => {
		if (context.socket) {
			context.socket.on('skeleton-info', setVersionInfo)
			context.socket.on('update_data', setUpdateData)
			context.socket.emit('update_data')

			return () => {
				context.socket.off('skeleton-info', setVersionInfo)
				context.socket.off('update_data', setUpdateData)
			}
		}
	}, [context.socket])

	const versionString = versionInfo ? `${versionInfo.appVersion} (${versionInfo.appBuild.replace("master-", "").replace(versionInfo.appVersion + "-", "")})` : '?'

	return (
		<CHeader colorScheme="dark">
			<CHeaderBrand>
				<span style={{ fontWeight: 'bold' }}>Bitfocus</span> Companion
        </CHeaderBrand>

			<CHeaderNav>
				<CHeaderNavItem>
					<CHeaderNavLink target="_new" title="Version Number" href="https://bitfocus.io/companion/">
						{versionString}
					</CHeaderNavLink>
				</CHeaderNavItem>

				<CHeaderNavItem>
					<CHeaderNavLink target="_new" href={updateData?.link || "https://bitfocus.io/companion/"}>
						{updateData?.message || ''}
					</CHeaderNavLink>
				</CHeaderNavItem>
			</CHeaderNav>
		</CHeader>
	)
}