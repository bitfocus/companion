import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '~/lib/utils'

const alertVariants = cva(
	"grid gap-0.5 rounded-lg border px-2.5 py-2 text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4 w-full relative group/alert",
	{
		variants: {
			variant: {
				default: 'bg-card text-card-foreground',
				destructive:
					'bg-danger-bg-subtle border-danger-border-subtle text-danger-text-emphasis *:data-[slot=alert-description]:text-danger-text-emphasis/90',
				// A caution rather than a danger. Both tint the whole box, from the web UI's tokens
				warning:
					'bg-warning-bg-subtle border-warning-border-subtle text-warning-text-emphasis *:data-[slot=alert-description]:text-warning-text-emphasis/90',
			},
		},
		defaultVariants: {
			variant: 'default',
		},
	}
)

function Alert({
	className,
	variant,
	...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>): React.JSX.Element {
	return <div data-slot="alert" role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>): React.JSX.Element {
	return (
		<div
			data-slot="alert-title"
			className={cn(
				'font-medium group-has-[>svg]/alert:col-start-2 [&_a]:hover:text-foreground [&_a]:underline [&_a]:underline-offset-3',
				className
			)}
			{...props}
		/>
	)
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>): React.JSX.Element {
	return (
		<div
			data-slot="alert-description"
			className={cn(
				'text-muted-foreground text-sm text-pretty [&_p:not(:last-child)]:mb-4 [&_a]:hover:text-foreground [&_a]:underline [&_a]:underline-offset-3',
				className
			)}
			{...props}
		/>
	)
}

function AlertAction({ className, ...props }: React.ComponentProps<'div'>): React.JSX.Element {
	return <div data-slot="alert-action" className={cn('absolute top-2 right-2', className)} {...props} />
}

export { Alert, AlertTitle, AlertDescription, AlertAction }
