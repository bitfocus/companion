import { faGithub } from '@fortawesome/free-brands-svg-icons'
import { faBug, faCogs, faFileLines } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { Meta, StoryObj } from '@storybook/react'
import classNames from 'classnames'
import { EditPanelTabLink } from './EditPanelTabs'
import {
	EDIT_TAB_ACTIVE_CLASS,
	EDIT_TAB_BAR_CLASS,
	EDIT_TAB_CLASS,
	EDIT_TAB_INACTIVE_CLASS,
} from './editPanelTabStyles'

const meta = {
	component: EditPanelTabLink,
	decorators: [
		(Story) => (
			<div style={{ maxWidth: 560, background: 'var(--color-surface)' }}>
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof EditPanelTabLink>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
	args: { href: 'https://github.com/bitfocus/companion/issues', icon: faBug, label: 'Issues' },
}

/** The links sit at the end of an editor's tab bar, after its in-page tabs. */
export const InTabBar: Story = {
	args: { href: 'https://github.com/bitfocus/companion', icon: faGithub, label: 'GitHub' },
	render: (args) => (
		<div className={EDIT_TAB_BAR_CLASS}>
			<button type="button" className={classNames(EDIT_TAB_CLASS, EDIT_TAB_ACTIVE_CLASS)}>
				<FontAwesomeIcon icon={faCogs} />
				<span>Settings</span>
			</button>
			<button type="button" className={classNames(EDIT_TAB_CLASS, EDIT_TAB_INACTIVE_CLASS)}>
				<FontAwesomeIcon icon={faFileLines} />
				<span>Docs</span>
			</button>
			<EditPanelTabLink {...args} />
		</div>
	),
}
