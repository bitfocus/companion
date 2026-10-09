import { createFileRoute } from '@tanstack/react-router'
import { ConnectionVariablesPage } from '~/Variables/index.js'

export const Route = createFileRoute('/_app/variables/_connections')({
	component: ConnectionVariablesPage,
})
