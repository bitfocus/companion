import { ConfigStaticField } from '../Components/ConfigFieldRows.js'

export function RosstalkConfig(): React.JSX.Element {
	return <ConfigStaticField label="Listen Port" value={7788} help="This port is fixed." />
}
