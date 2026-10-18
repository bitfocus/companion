import { useEffect, useState } from 'react'
import type { LauncherAppInfo, LauncherVersionWarning } from '@companion-app/shared/Model/LauncherAppInfo.js'
import type { LauncherConfig } from '~/types/config'
import type { NetworkInterfaceOption } from './interfaceOptions'

export interface LauncherInfo {
	config: LauncherConfig
	appInfo: LauncherAppInfo
	platform: string
	versionWarning: LauncherVersionWarning | null
}

export function useLauncherInfo(): { info: LauncherInfo | null; interfaces: NetworkInterfaceOption[] } {
	const [info, setInfo] = useState<LauncherInfo | null>(null)
	const [interfaces, setInterfaces] = useState<NetworkInterfaceOption[]>([])

	useEffect(() => {
		const unsubscribeInfo = window.api.receive(
			'info',
			(
				config: LauncherConfig,
				appInfo: LauncherAppInfo,
				platform: string,
				versionWarning: LauncherVersionWarning | null
			) => {
				setInfo({ config, appInfo, platform, versionWarning })
			}
		)
		const unsubscribeInterfaces = window.api.receive('network-interfaces:get', (list: NetworkInterfaceOption[]) =>
			setInterfaces(list)
		)

		window.api.send('info')
		window.api.send('network-interfaces:get')

		return () => {
			unsubscribeInfo()
			unsubscribeInterfaces()
		}
	}, [])

	return { info, interfaces }
}
