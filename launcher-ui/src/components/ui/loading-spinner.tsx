import * as React from 'react'
import { cn } from '~/lib/utils'
import { Loader2Icon } from 'lucide-react'

export function LoadingSpinner({ className, ...props }: React.ComponentProps<'svg'>): JSX.Element {
	return <Loader2Icon role="status" aria-label="Loading" className={cn('size-4 animate-spin', className)} {...props} />
}
