import { createFileRoute } from '@tanstack/react-router'
import { CustomVariablesPage } from '~/CustomVariables/Page.js'

export const Route = createFileRoute('/_app/custom-variables')({
	component: CustomVariablesPage,
})
