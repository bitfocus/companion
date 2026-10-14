import { CopyPlus } from 'lucide-react'

/**
 * The icon for duplicate / clone buttons, kept distinct from the copy-to-clipboard icon. Lucide draws
 * outlines, so the stroke is heavier than its default to sit alongside the solid FontAwesome icons.
 */
export function DuplicateIcon(): React.JSX.Element {
	return <CopyPlus className="w-3.5 h-3.5" strokeWidth={2.75} aria-hidden="true" />
}
