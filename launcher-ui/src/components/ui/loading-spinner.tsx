import React from 'react'
import { cn } from '~/lib/utils'

interface LoadingSpinnerProps {
	size?: 'sm' | 'md' | 'lg'
	className?: string
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps): JSX.Element {
	const sizeClasses = {
		sm: 'h-4 w-4',
		md: 'h-8 w-8',
		lg: 'h-12 w-12',
	}

	return (
		<div className={cn('flex items-center justify-center', className)}>
			<div className={cn('animate-spin rounded-full border-2 border-gray-300 border-t-gray-900', sizeClasses[size])} />
		</div>
	)
}
