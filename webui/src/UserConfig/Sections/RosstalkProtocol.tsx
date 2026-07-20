import { observer } from 'mobx-react-lite'
import { useContext } from 'react'
import { makeAbsolutePath } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

export const RosstalkProtocol = observer(function RosstalkProtocol() {
	const { userConfig } = useContext(RootAppStoreContext)

	return (
		<>
			<p>
				Remote triggering can be done by sending RossTalk commands to port{' '}
				<code>{userConfig.properties?.rosstalk_enabled ? '7788' : 'disabled'}</code>. Commands use the <code>CC</code>{' '}
				(Custom Command) verb and must be terminated with <code>\r\n</code>.
			</p>
			<p>
				<strong>Commands:</strong>
			</p>
			<ul>
				<li>
					<code>CC</code> &lt;page&gt;/&lt;row&gt;/&lt;column&gt;
					<br />
					<i>Press and release button</i>
				</li>
				<li>
					<code>CC</code> &lt;page&gt;:&lt;button&gt;
					<br />
					<i>Press and release button</i>
				</li>
			</ul>

			<p>
				<strong>Examples</strong>
			</p>

			<p>
				Press and release row 3, column 1 on page 2
				<br />
				<code>CC 2/3/1</code>
			</p>
			<p>
				Press and release button 5 on page 2
				<br />
				<code>CC 2:5</code>
			</p>

			<p>
				See the{' '}
				<a target="_blank" href={makeAbsolutePath('/user-guide/remote-control/rosstalk-control')}>
					full documentation
				</a>{' '}
				for setup details, including use with ProPresenter.
			</p>
		</>
	)
})
