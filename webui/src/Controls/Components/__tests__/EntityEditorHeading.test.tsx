import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { PanelCollapseHelperProvider } from '~/Helpers/CollapseHelper.js'
import { EntityEditorHeading } from '../EntityEditorHeadingProps.js'

function renderHeading(heading: string | null, childEntityIds: string[], subheading: string | null) {
	return render(
		<PanelCollapseHelperProvider storageId="entity-editor-heading-test" knownPanelIds={childEntityIds}>
			<EntityEditorHeading heading={heading} ownerId={null} childEntityIds={childEntityIds} subheading={subheading} />
		</PanelCollapseHelperProvider>
	)
}

describe('EntityEditorHeading', () => {
	afterEach(() => {
		localStorage.clear()
	})

	it('offers expand/collapse all for a list without a title', async () => {
		renderHeading(null, ['a', 'b'], null)

		await userEvent.click(screen.getByRole('button', { name: 'Collapse all' }))
		expect(screen.getByRole('button', { name: 'Expand all' })).toBeInTheDocument()
		expect(screen.queryByRole('button', { name: 'Collapse all' })).not.toBeInTheDocument()

		await userEvent.click(screen.getByRole('button', { name: 'Expand all' }))
		expect(screen.getByRole('button', { name: 'Collapse all' })).toBeInTheDocument()
	})

	it('renders nothing for an empty list without a title or subheading', () => {
		const { container } = renderHeading(null, [], null)
		expect(container).toBeEmptyDOMElement()
	})

	it('shows the subheading of an empty list without a title, but no heading row', () => {
		const { container } = renderHeading(null, [], 'Some help')
		expect(screen.getByText('Some help')).toBeInTheDocument()
		expect(container.querySelector('.entity-editor-heading')).toBeNull()
	})

	it('shows the title and controls together when there is a title', () => {
		renderHeading('Local Variables', ['a'], null)
		expect(screen.getByText('Local Variables')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Collapse all' })).toBeInTheDocument()
	})
})
