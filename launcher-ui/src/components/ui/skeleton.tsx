import React from 'react'
import { cn } from '~/lib/utils'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>): JSX.Element {
	return <div data-slot="skeleton" className={cn('bg-muted rounded-md animate-pulse', className)} {...props} />
}

export { Skeleton }
