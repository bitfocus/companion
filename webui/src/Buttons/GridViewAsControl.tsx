import { EyeIcon, EyeOffIcon } from 'lucide-react'
import './GridViewAs.css'
import { observer } from 'mobx-react-lite'
import { useCallback } from 'react'
import type { DropdownChoiceId } from '@companion-app/shared/Model/Common.js'
import { Button } from '~/Components/Button.js'
import { SimpleDropdownInputField } from '~/Components/DropdownInputFieldSimple.js'
import { NumberInputField } from '~/Components/NumberInputField.js'
import { Popover } from '~/Components/Popover.js'
import { GRID_VIEW_AS_OFFSET_LIMIT } from './GridViewAs.js'
import { GRID_VIEW_AS_CUSTOM_ID, GRID_VIEW_AS_NOTHING_ID, type GridViewAsController } from './useGridViewAs.js'

interface GridViewAsControlProps {
	controller: GridViewAsController
	/** Held by the panel, so that the banner can open it too */
	configureOpen: boolean
	setConfigureOpen: (open: boolean) => void
}

/**
 * Turning the view on and off, beside the zoom which is the other thing that changes how the grid is
 * drawn without changing what is on it.
 *
 * A split button: the eye applies the view, and the caret beside it chooses what to apply. They are
 * one control because they are one thing - the caret is only ever used to feed the eye.
 *
 * The configuration is a popover rather than a panel of its own: it is one dropdown, sometimes a
 * second, and two numbers, and putting that somewhere permanent would cost more of the page than it
 * is worth.
 */
export const GridViewAsControl = observer(function GridViewAsControl({
	controller,
	configureOpen,
	setConfigureOpen,
}: GridViewAsControlProps): React.JSX.Element {
	const { state, setEnabled } = controller

	return (
		<div className="btn-group ms-1">
			<Button
				color={state.enabled ? 'primary' : 'light'}
				onClick={() => setEnabled(!state.enabled)}
				title={state.enabled ? 'Show the whole grid again' : 'View the grid as one of your surfaces'}
				className="grid-view-as-toggle"
			>
				{state.enabled ? <EyeIcon size={16} /> : <EyeOffIcon size={16} />}
			</Button>

			<Popover.Root open={configureOpen} onOpenChange={setConfigureOpen}>
				<Popover.Trigger
					color={state.enabled ? 'primary' : 'light'}
					caret
					title="Choose which surface to view as"
					aria-label="Choose which surface to view as"
					className="grid-view-as-configure"
				/>
				<Popover.Popup className="grid-view-as-popover" align="end">
					<GridViewAsPopoverContent controller={controller} />
				</Popover.Popup>
			</Popover.Root>
		</div>
	)
})

const GridViewAsPopoverContent = observer(function GridViewAsPopoverContent({
	controller,
}: {
	controller: GridViewAsController
}): React.JSX.Element {
	const { state, surfaceChoices, surfaceTypeChoices, setSelection, setOffset } = controller

	const selection = state.selection
	const selectedSurfaceId = !selection
		? GRID_VIEW_AS_NOTHING_ID
		: selection.type === 'surface'
			? selection.surfaceId
			: GRID_VIEW_AS_CUSTOM_ID

	const chooseSurface = useCallback(
		(value: DropdownChoiceId) => {
			if (value === GRID_VIEW_AS_NOTHING_ID) {
				// Nothing to do - this is only ever offered while it is already the answer
			} else if (value === GRID_VIEW_AS_CUSTOM_ID) {
				// Starting from the first model we know about, so choosing this shows something rather than
				// an empty view which has to be configured before it does anything. Only offered when there
				// is a model to start from.
				setSelection({
					type: 'surfaceType',
					surfaceType: String(surfaceTypeChoices[0].id),
					offset: { rows: 0, columns: 0 },
				})
			} else {
				setSelection({ type: 'surface', surfaceId: String(value) })
			}
		},
		[setSelection, surfaceTypeChoices]
	)

	const chooseSurfaceType = useCallback(
		(value: DropdownChoiceId) => {
			setSelection({
				type: 'surfaceType',
				surfaceType: String(value),
				offset: selection?.type === 'surfaceType' ? selection.offset : { rows: 0, columns: 0 },
			})
		},
		[setSelection, selection]
	)

	// Nothing to view as at all: no surface has ever been seen, so there is neither one to pick nor a
	// model to pick. Said plainly rather than shown as an empty dropdown which does nothing.
	if (surfaceChoices.length === 0 && surfaceTypeChoices.length === 0) {
		return (
			<p className="grid-view-as-note">
				Companion has not seen a surface yet, so there is nothing to view the grid as. Connect one - or install support
				for one from the module store - and it will be offered here.
			</p>
		)
	}

	const choices = [
		// Offered only while it is the answer, so that having chosen something there is no way back to
		// having chosen nothing
		...(selection ? [] : [{ id: GRID_VIEW_AS_NOTHING_ID, label: 'Choose a surface…' }]),
		...surfaceChoices,
		// A model is only worth offering when one is known; the note below says why when none is
		...(surfaceTypeChoices.length > 0 ? [{ id: GRID_VIEW_AS_CUSTOM_ID, label: 'A model of surface…' }] : []),
	]

	const model = selection?.type === 'surfaceType' ? selection : null

	return (
		<>
			<div className="grid-view-as-field">
				<label className="grid-view-as-field-label" htmlFor="grid-view-as-surface">
					View as
				</label>
				<SimpleDropdownInputField
					id="grid-view-as-surface"
					choices={choices}
					value={selectedSurfaceId}
					setValue={chooseSurface}
				/>
			</div>

			{surfaceTypeChoices.length === 0 && (
				<p className="grid-view-as-note">
					Companion learns how a surface is laid out when one connects, so a surface which has never been plugged in
					cannot be chosen by model yet.
				</p>
			)}

			{model && (
				<>
					<div className="grid-view-as-field">
						<label className="grid-view-as-field-label" htmlFor="grid-view-as-type">
							Model
						</label>
						<SimpleDropdownInputField
							id="grid-view-as-type"
							choices={surfaceTypeChoices}
							value={model.surfaceType}
							setValue={chooseSurfaceType}
						/>
					</div>

					<p className="grid-view-as-note">
						Where on the grid this surface would sit, so its buttons can be programmed before it arrives.
					</p>

					<div className="grid-view-as-offsets">
						<div className="grid-view-as-field">
							<label className="grid-view-as-field-label" htmlFor="grid-view-as-offset-columns">
								Column offset
							</label>
							<NumberInputField
								id="grid-view-as-offset-columns"
								min={-GRID_VIEW_AS_OFFSET_LIMIT}
								max={GRID_VIEW_AS_OFFSET_LIMIT}
								value={model.offset.columns}
								setValue={(columns) => setOffset({ rows: model.offset.rows, columns })}
							/>
						</div>

						<div className="grid-view-as-field">
							<label className="grid-view-as-field-label" htmlFor="grid-view-as-offset-rows">
								Row offset
							</label>
							<NumberInputField
								id="grid-view-as-offset-rows"
								min={-GRID_VIEW_AS_OFFSET_LIMIT}
								max={GRID_VIEW_AS_OFFSET_LIMIT}
								value={model.offset.rows}
								setValue={(rows) => setOffset({ rows, columns: model.offset.columns })}
							/>
						</div>
					</div>
				</>
			)}
		</>
	)
})
