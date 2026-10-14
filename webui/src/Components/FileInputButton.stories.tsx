import { faFileImport } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { FileInputButton } from './FileInputButton'

const meta = {
	component: FileInputButton,
	args: {
		accept: undefined,
		onFileSelected: (file) => console.log('Selected file', file),
		color: 'primary',
		children: 'Choose file',
	},
} satisfies Meta<typeof FileInputButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithIcon: Story = {
	args: {
		color: 'primary',
		accept: '.companionconfig,.yaml',
		children: (
			<>
				<FontAwesomeIcon icon={faFileImport} className="me-2" />
				Import configuration
			</>
		),
	},
}

export const ImagesOnly: Story = {
	args: { accept: 'image/*', children: 'Choose image' },
}

export const Disabled: Story = {
	args: { disabled: true },
}

export const ShowsSelectedFile: Story = {
	render: function ShowsSelectedFile(args) {
		const [file, setFile] = useState<File | null>(null)
		return (
			<div>
				<FileInputButton {...args} onFileSelected={setFile} />
				<p className="mt-2">{file ? `${file.name} (${file.size} bytes)` : 'No file selected'}</p>
			</div>
		)
	},
}
