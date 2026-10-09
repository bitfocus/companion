import { makeAbsolutePath } from '~/Resources/util.js'

interface EmulatorListHeaderProps {
	installName: string | undefined
}

export function EmulatorListHeader({ installName }: EmulatorListHeaderProps): React.JSX.Element {
	const title = installName && installName.length > 0 ? installName : 'Emulator Chooser'

	return (
		<header className="emulator-list-header">
			<img
				src={makeAbsolutePath('/img/logo-glass.png')}
				alt="Bitfocus Companion"
				className="emulator-list-logo"
				style={{ height: 36 }}
			/>
			<div className="emulator-list-heading">
				<h1>{title}</h1>
				<span className="emulator-list-subheading">Choose an emulator to control</span>
			</div>
		</header>
	)
}
