import { createFileRoute } from '@tanstack/react-router'
import { SettingsGeneralPage } from '../../../UserConfig/general.js'

export const Route = createFileRoute('/_app/settings/general')({
	component: SettingsGeneralPage,
})
