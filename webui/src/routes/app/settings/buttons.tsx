import { createFileRoute } from '@tanstack/react-router'
import { SettingsButtonsPage } from '../../../UserConfig/buttons.js'

export const Route = createFileRoute('/_app/settings/buttons')({
	component: SettingsButtonsPage,
})
