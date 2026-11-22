import { createFileRoute } from '@tanstack/react-router'
import { CustomElementsPage } from '~/CustomElements/Page.js'

export const Route = createFileRoute('/_app/custom-elements')({
	component: CustomElementsPage,
})
