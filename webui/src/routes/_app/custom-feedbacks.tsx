import { createFileRoute } from '@tanstack/react-router'
import { CustomFeedbacksPage } from '~/CustomFeedbacks/Page.js'

export const Route = createFileRoute('/_app/custom-feedbacks')({
	component: CustomFeedbacksPage,
})
