import { faCog } from '@fortawesome/free-solid-svg-icons'
import { observer } from 'mobx-react-lite'
import { memo } from 'react'
import { PageHeader } from '~/Layout/PageHeader.js'
import { PageIntro } from '~/Layout/PageIntro'
import { SettingsCard } from './Components/SettingsCard.js'
import { useUserConfigProps } from './Context.js'
import { CompanionConfig } from './Sections/CompanionConfig.js'
import { DataCollectionConfig } from './Sections/DataCollection.js'
import { SettingsNav } from './SettingsNav.js'

export const SettingsGeneralPage = memo(function UserConfig() {
	return (
		<div className="page-shell">
			<PageHeader icon={faCog} title="Settings" helpAction="/user-guide/config/settings#general" />

			<div className="page-shell-body">
				<SettingsNav activeTab="general" />

				<div className="page-scroll">
					<div className="primary-panel">
						<PageIntro title="General Settings">Settings take effect automatically as you change them.</PageIntro>
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
				<CompanionConfig {...userConfigProps} />
			</SettingsCard>
			<SettingsCard>
				<DataCollectionConfig {...userConfigProps} />
			</SettingsCard>
		</div>
	)
})
