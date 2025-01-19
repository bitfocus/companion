import { createFileRoute } from '@tanstack/react-router'
import { CloudPage } from '../../Cloud/index.js'

export const Route = createFileRoute('/_app/cloud')({
	component: CloudPage,
})
