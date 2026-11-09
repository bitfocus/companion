import { TriangleAlert } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { LauncherActions } from './LauncherActions'
import { LauncherHeader } from './LauncherHeader'
import { LauncherSettings } from './LauncherSettings'
import { LauncherStatus } from './LauncherStatus'
import { useLauncherInfo } from './useLauncherInfo'

export function Launcher(): React.JSX.Element {
	const { info, interfaces } = useLauncherInfo()
	const rootRef = useRef<HTMLDivElement>(null)

	// The window has no fixed height: it is resized to fit this content
	useEffect(() => {
		const root = rootRef.current
		if (!root) return

		const resizeObserver = new ResizeObserver(() => window.api.send('setHeight', root.offsetHeight))
		resizeObserver.observe(root)
		return () => resizeObserver.disconnect()
	}, [])

	const appInfo = info?.appInfo

	return (
		<div className="launcher" ref={rootRef}>
			<LauncherHeader version={appInfo?.appVersion ?? null} />
			<LauncherStatus
				status={appInfo?.appStatus ?? 'starting'}
				message={appInfo?.appMessage ?? null}
				launchUrl={appInfo?.appLaunch ?? null}
			/>

			{info?.versionWarning?.platform === 'macos' && (
				<div className="launcher-warning" role="alert">
					<TriangleAlert />
					<div>
						<strong>Last release for this macOS version</strong>
						Upgrade to macOS {info.versionWarning.minimumVersion} or later to keep receiving Companion updates.
					</div>
				</div>
			)}

			{info && (
				<div className="launcher-body">
					<LauncherSettings config={info.config} interfaces={interfaces} platform={info.platform} />
					<LauncherActions canLaunch={info.appInfo.appStatus === 'running'} />
				</div>
			)}
		</div>
	)
}
