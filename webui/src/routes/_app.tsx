import { createFileRoute } from '@tanstack/react-router'
import App from '~/App.js'
import { ErrorFallback } from '~/util.js'
import React from 'react'

export const Route = createFileRoute('/_app')({
	component: App,
	errorComponent: ({ error, reset }) => {
		return <ErrorFallback error={error} resetErrorBoundary={reset} />
	},
})
