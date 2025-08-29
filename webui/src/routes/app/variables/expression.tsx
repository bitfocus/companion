import { createFileRoute } from '@tanstack/react-router'
import { ExpressionVariablesPage } from '~/Variables/ExpressionVariables/Page.js'

export const Route = createFileRoute('/_app/variables/expression')({
	component: ExpressionVariablesPage,
})
