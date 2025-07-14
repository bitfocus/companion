import { createFileRoute } from '@tanstack/react-router'
import { SettingsBackupsPage } from '../../../UserConfig/backups.js'

export const Route = createFileRoute('/_app/settings/backups')({
	component: SettingsBackupsPage,
})
