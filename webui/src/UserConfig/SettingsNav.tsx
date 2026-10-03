import { SETTINGS_SECTION } from '~/Layout/navRegistry.js'
import { PageTabs } from '~/Layout/PageTabs'

interface SettingsNavProps {
	activeTab: 'general' | 'buttons' | 'protocols' | 'backups' | 'advanced'
}

export function SettingsNav({ activeTab }: SettingsNavProps): React.JSX.Element {
	return <PageTabs tabs={SETTINGS_SECTION.pages} activeTab={activeTab} />
}
