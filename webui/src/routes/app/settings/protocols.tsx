import { createFileRoute } from '@tanstack/react-router'
import { SettingsProtocolsPage } from '../../../UserConfig/protocols.js'

export const Route = createFileRoute('/_app/settings/protocols')({
	component: SettingsProtocolsPage,
})
