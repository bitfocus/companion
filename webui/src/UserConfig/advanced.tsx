import { faCog } from '@fortawesome/free-solid-svg-icons'
import { observer } from 'mobx-react-lite'
import { memo } from 'react'
import { PageHeader } from '~/Layout/PageHeader.js'
import { PageIntro } from '~/Layout/PageIntro'
import { SettingsCard } from './Components/SettingsCard.js'
import { useUserConfigProps } from './Context.js'
import { AdminPasswordConfig } from './Sections/AdminPasswordConfig.js'
import { ExperimentsConfig } from './Sections/ExperimentsConfig.js'
import { HttpsConfig } from './Sections/HttpsConfig.js'
import { SettingsNav } from './SettingsNav.js'

export const SettingsAdvancedPage = memo(function UserConfig() {
	return (
		<div className="page-shell">
			<PageHeader icon={faCog} title="Settings" helpAction="/user-guide/config/settings#advanced" />

			<div className="page-shell-body">
				<SettingsNav activeTab="advanced" />

				<div className="page-scroll">
					<div className="primary-panel">
						<PageIntro title="Advanced Settings">
							Admin authentication, HTTPS certificates, and experimental features.
						</PageIntro>
						<UserConfigTable />
					</div>
				</div>
			</div>
		</div>
	)
})

const UserConfigTable = observer(function UserConfigTable() {
	const userConfigProps = useUserConfigProps()
	if (!userConfigProps) return null

	return (
		<div className="w-full space-y-4">
			<SettingsCard>
				<AdminPasswordConfig {...userConfigProps} />
			</SettingsCard>
			<SettingsCard>
				<HttpsConfig {...userConfigProps} />
			</SettingsCard>
			<SettingsCard>
				<ExperimentsConfig {...userConfigProps} />
			</SettingsCard>
		</div>
	)
})
