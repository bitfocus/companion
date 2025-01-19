import { createFileRoute } from '@tanstack/react-router'
import { ModulesPage } from '../../Modules/index.js'

export const Route = createFileRoute('/_app/modules')({
	component: ModulesPage,
})
