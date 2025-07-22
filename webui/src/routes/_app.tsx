import { createFileRoute, type ErrorComponentProps } from '@tanstack/react-router'
import App from '~/App.js'
import { ErrorFallback } from '~/Resources/Error'
import React from 'react'

export const Route = createFileRoute('/_app')({
	component: App,
	errorComponent: ({ error, reset }: ErrorComponentProps) => {
		return <ErrorFallback error={error} resetErrorBoundary={reset} />
	},
})
