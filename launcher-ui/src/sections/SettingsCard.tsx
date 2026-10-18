import '../../../webui/src/surface-card.css'
import { Label } from '~/components/ui/label'

/** A card of settings rows, like a settings section in the web UI */
export function SettingsCard({ children }: { children: React.ReactNode }): React.JSX.Element {
	return <div className="surface-card">{children}</div>
}

interface SettingsRowProps {
	label: string
	/** The id of the control, so the label can point at it */
	htmlFor: string
	/** Explanation shown under the control, or `null` */
	help: React.ReactNode
	children: React.ReactNode
}

/** One labelled row of a settings card: the label, then the control, then its help */
export function SettingsRow({ label, htmlFor, help, children }: SettingsRowProps): React.JSX.Element {
	return (
		<div className="settings-row">
			<Label htmlFor={htmlFor} className="text-xs font-semibold">
				{label}
			</Label>
			<div className="flex min-w-0 items-center gap-2">{children}</div>
			{help && <p className="settings-row-help">{help}</p>}
		</div>
	)
}
