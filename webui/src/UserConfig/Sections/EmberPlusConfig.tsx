import { ConfigStaticField } from '../Components/ConfigFieldRows.js'

export function EmberPlusConfig(): React.JSX.Element {
	return <ConfigStaticField label="Listen Port" value={9092} help="This port is fixed." />
}
