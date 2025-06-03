import { createFileRoute } from '@tanstack/react-router'
import { CustomVariablesListPage } from '~/Variables/CustomVariablesList.js'

export const Route = createFileRoute('/_app/variables/custom')({
	component: CustomVariablesListPage,
})
