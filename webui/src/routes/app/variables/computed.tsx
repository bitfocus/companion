import { createFileRoute } from '@tanstack/react-router'
import { ComputedVariablesPage } from '~/Variables/ComputedVariables/Page.js'

export const Route = createFileRoute('/_app/variables/computed')({
	component: ComputedVariablesPage,
})
