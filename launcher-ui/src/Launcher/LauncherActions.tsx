import { ArrowUpRight } from 'lucide-react'
import { Button } from '~/components/ui/button'

export function LauncherActions({ canLaunch }: { canLaunch: boolean }): React.JSX.Element {
	return (
		<div className="launcher-actions">
			<Button size="lg" disabled={!canLaunch} onClick={() => window.api.send('launcher-open-gui')}>
				Launch GUI
				<ArrowUpRight data-icon="inline-end" />
			</Button>
			<Button variant="outline" size="lg" onClick={() => window.api.send('launcher-minimize')}>
				Hide
			</Button>
			<Button variant="outline" size="lg" onClick={() => window.api.send('launcher-close')}>
				Quit
			</Button>
		</div>
	)
}
