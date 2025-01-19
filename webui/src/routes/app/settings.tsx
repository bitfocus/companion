import { createFileRoute } from '@tanstack/react-router'
import { UserConfigPage } from '../../UserConfig/index.js'

export const Route = createFileRoute('/_app/settings')({
	component: UserConfigPage,
})
