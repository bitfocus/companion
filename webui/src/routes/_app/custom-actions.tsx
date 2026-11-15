import { createFileRoute } from '@tanstack/react-router'
import { CustomActionsPage } from '~/CustomActions/Page.js'

export const Route = createFileRoute('/_app/custom-actions')({
	component: CustomActionsPage,
})
