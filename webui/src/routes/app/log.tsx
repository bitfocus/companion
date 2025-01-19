import { createFileRoute } from '@tanstack/react-router'
import { LogPanel } from '../../LogPanel.js'

export const Route = createFileRoute('/_app/log')({
	component: LogPanel,
})
