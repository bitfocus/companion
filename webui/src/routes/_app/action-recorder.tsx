import { createFileRoute } from '@tanstack/react-router'
import { ActionRecorder } from '~/ActionRecorder/index.js'

export const Route = createFileRoute('/_app/action-recorder')({
	component: ActionRecorder,
})
