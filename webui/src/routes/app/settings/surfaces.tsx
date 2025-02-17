import { createFileRoute } from '@tanstack/react-router'
import { SettingsSurfacesPage } from '../../../UserConfig/surfaces.js'

export const Route = createFileRoute('/_app/settings/surfaces')({
	component: SettingsSurfacesPage,
})
