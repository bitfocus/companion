import '../../../webui/src/Components/LogoMark.css'
import './LogoMark.css'
// The same logo file as the web UI's sidebar
import logoUrl from '../../../webui/public/img/logo-glass.png'

export function LogoMark(): React.JSX.Element {
	return (
		<span className="logo-mark">
			<img src={logoUrl} alt="Companion logo" />
		</span>
	)
}
