import { createFileRoute } from '@tanstack/react-router'
import { SettingsAdvancedPage } from '../../../UserConfig/advanced.js'

export const Route = createFileRoute('/_app/settings/advanced')({
	component: SettingsAdvancedPage,
})
