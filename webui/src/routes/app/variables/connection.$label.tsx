import { createFileRoute } from '@tanstack/react-router'
import { VariablesListPage } from '~/Variables/index.js'

export const Route = createFileRoute('/_app/variables/connection/$label')({
	component: VariablesListPage,
})
