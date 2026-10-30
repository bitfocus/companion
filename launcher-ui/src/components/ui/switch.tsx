import { Switch as SwitchPrimitive } from '@base-ui/react/switch'
import { cn } from '~/lib/utils'

function Switch({ className, ...props }: SwitchPrimitive.Root.Props): React.JSX.Element {
	return (
		<SwitchPrimitive.Root
			data-slot="switch"
			className={cn(
				'data-checked:bg-primary data-unchecked:bg-input focus-visible:border-ring focus-visible:ring-ring/50 dark:data-unchecked:bg-input/80 peer group/switch relative inline-flex h-[18.4px] w-8 shrink-0 items-center rounded-full border border-transparent transition-all outline-none focus-visible:ring-[3px] data-disabled:cursor-not-allowed data-disabled:opacity-50',
				className
			)}
			{...props}
		>
			<SwitchPrimitive.Thumb
				data-slot="switch-thumb"
				className="bg-background dark:data-unchecked:bg-foreground dark:data-checked:bg-primary-foreground pointer-events-none block size-4 rounded-full ring-0 transition-transform data-checked:translate-x-[calc(100%-2px)] data-unchecked:translate-x-0"
			/>
		</SwitchPrimitive.Root>
	)
}

export { Switch }
