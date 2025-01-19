import { createFileRoute } from '@tanstack/react-router'
import { ButtonsPage } from '../../Buttons/index.js'

export const Route = createFileRoute('/_app/buttons')({
	component: ButtonsPage,
})
