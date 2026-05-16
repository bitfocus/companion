import type { Decorator, Meta, StoryObj } from '@storybook/react'
import { useArgs } from 'storybook/preview-api'
import { mockRootAppStore } from '../../.storybook/mockRootAppStore'
import { RootAppStoreContext, type RootAppStore } from '../Stores/RootAppStore'
import { ButtonGridHeader, PageNumberPicker, type PageNumberOption } from './ButtonGridHeader'

const samplePages: PageNumberOption[] = [
	{ value: 1, label: '1 (Main)' },
	{ value: 2, label: '2 (Cameras)' },
	{ value: 3, label: '3 (Audio)' },
	{ value: 4, label: '4 (Graphics)' },
	{ value: 5, label: '5' },
]

const meta = {
	component: PageNumberPicker,
	args: {
		pageNumber: 1,
		pageOptions: samplePages,
		changePage: undefined,
		setPage: undefined,
	},
	render: function Render(args) {
		const [, setArgs] = useArgs<{ pageNumber: number }>()
		return (
			<PageNumberPicker
				{...args}
				changePage={
					args.changePage ? (delta) => setArgs({ pageNumber: Math.max(1, args.pageNumber + delta) }) : undefined
				}
				setPage={args.setPage ? (page) => setArgs({ pageNumber: page }) : undefined}
			/>
		)
	},
} satisfies Meta<typeof PageNumberPicker>

export default meta
type Story = StoryObj<typeof meta>

/** Read-only — no changePage or setPage, just displays current page */
export const ReadOnly: Story = {}

/** Interactive — prev/next buttons + dropdown navigation both work */
export const Interactive: Story = {
	args: {
		changePage: () => {},
		setPage: () => {},
	},
}

/** DropdownOnly — setPage only, no prev/next arrow buttons */
export const DropdownOnly: Story = {
	args: {
		setPage: () => {},
	},
}

/** ManyPages — shows the searchable dropdown is useful with many pages */
export const ManyPages: Story = {
	args: {
		pageNumber: 5,
		pageOptions: Array.from({ length: 20 }, (_, i) => ({ value: i + 1, label: `${i + 1}` })),
		changePage: () => {},
		setPage: () => {},
	},
}

/** WithChildren — the children slot renders in the right-buttons area */
export const WithChildren: Story = {
	args: {
		changePage: () => {},
		setPage: () => {},
	},
	render: function Render(args) {
		const [, setArgs] = useArgs<{ pageNumber: number }>()
		return (
			<PageNumberPicker
				{...args}
				changePage={(delta) => setArgs({ pageNumber: Math.max(1, args.pageNumber + delta) })}
				setPage={(page) => setArgs({ pageNumber: page })}
			>
				<button>Edit</button>
				<button>Copy</button>
			</PageNumberPicker>
		)
	},
}

const withStorePagesDecorator: Decorator = (Story) => (
	<RootAppStoreContext.Provider
		value={
			{
				...mockRootAppStore,
				pages: {
					data: [{ name: 'Main' }, { name: 'Cameras' }, { name: '' }, { name: 'Audio' }, { name: '' }],
				},
			} as unknown as RootAppStore
		}
	>
		<Story />
	</RootAppStoreContext.Provider>
)

/** ButtonGridHeader — wraps PageNumberPicker and loads page list from the store */
export const WithStore: StoryObj<typeof ButtonGridHeader> = {
	name: 'ButtonGridHeader (with store)',
	decorators: [withStorePagesDecorator],
	render: function Render() {
		const [page, setPage] = useArgs<{ pageNumber: number }>()
		return (
			<ButtonGridHeader
				pageNumber={page.pageNumber ?? 1}
				changePage={(delta) => setPage({ pageNumber: Math.max(1, (page.pageNumber ?? 1) + delta) })}
				setPage={(p) => setPage({ pageNumber: p })}
			/>
		)
	},
}

const withNewPageAtEndDecorator: Decorator = (Story) => (
	<RootAppStoreContext.Provider
		value={
			{
				...mockRootAppStore,
				pages: {
					data: [{ name: 'Main' }, { name: 'Cameras' }],
				},
			} as unknown as RootAppStore
		}
	>
		<Story />
	</RootAppStoreContext.Provider>
)

/** NewPageAtEnd — ButtonGridHeader with an "Insert new page" option at the bottom of the dropdown */
export const NewPageAtEnd: StoryObj<typeof ButtonGridHeader> = {
	name: 'ButtonGridHeader (newPageAtEnd)',
	decorators: [withNewPageAtEndDecorator],
	render: function Render() {
		return <ButtonGridHeader pageNumber={1} changePage={() => {}} setPage={() => {}} newPageAtEnd />
	},
}
