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
import { GRID_VIEW_AS_CUSTOM_ID, type GridViewAsController } from './useGridViewAs.js'

interface GridViewAsControlProps {
	controller: GridViewAsController
}

/**
 * Turning the view on and off, beside the zoom which is the other thing that changes how the grid is
 * drawn without changing what is on it.
 *
 * The configuration is a popover rather than a panel of its own: it is one dropdown, sometimes a
 * second, and two numbers, and putting that somewhere permanent would cost more of the page than it
 * is worth.
 */
export const GridViewAsControl = observer(function GridViewAsControl({
	controller,
}: GridViewAsControlProps): React.JSX.Element {
	const { state, setEnabled } = controller

	return (
		<>
			<Button
				color={state.enabled ? 'primary' : 'light'}
				onClick={() => setEnabled(!state.enabled)}
				title={state.enabled ? 'Show the whole grid again' : 'View the grid as one of your surfaces'}
				className="ms-1"
			>
				{state.enabled ? <EyeIcon size={16} /> : <EyeOffIcon size={16} />}
			</Button>

			<Popover.Root>
				<Popover.Trigger color="light" caret title="Choose which surface to view as" className="ms-1" />
				<Popover.Popup className="grid-view-as-popover" align="end">
					<GridViewAsPopoverContent controller={controller} />
				</Popover.Popup>
			</Popover.Root>
		</>
	)
})

const GridViewAsPopoverContent = observer(function GridViewAsPopoverContent({
	controller,
}: GridViewAsControlProps): React.JSX.Element {
	const { state, surfaceChoices, surfaceTypeChoices, setSelection, setOffset } = controller

	const selectedSurfaceId = state.selection.type === 'surface' ? state.selection.surfaceId : GRID_VIEW_AS_CUSTOM_ID

	const chooseSurface = useCallback(
		(value: DropdownChoiceId) => {
			if (value === GRID_VIEW_AS_CUSTOM_ID) {
				// Starting from the first model we know about, so choosing this shows something rather than
				// an empty view which has to be configured before it does anything
				setSelection({
					type: 'surfaceType',
					surfaceType: String(surfaceTypeChoices[0]?.id ?? ''),
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
				offset: state.selection.type === 'surfaceType' ? state.selection.offset : { rows: 0, columns: 0 },
			})
		},
		[setSelection, state.selection]
	)

	const offset = state.selection.type === 'surfaceType' ? state.selection.offset : null

	return (
		<>
			<div className="grid-view-as-field">
				<label className="grid-view-as-field-label" htmlFor="grid-view-as-surface">
					View as
				</label>
				<SimpleDropdownInputField
					id="grid-view-as-surface"
					choices={surfaceChoices}
					value={selectedSurfaceId}
					setValue={chooseSurface}
				/>
			</div>

			{offset && (
				<>
					<div className="grid-view-as-field">
						<label className="grid-view-as-field-label" htmlFor="grid-view-as-type">
							Model
						</label>
						<SimpleDropdownInputField
							id="grid-view-as-type"
							choices={surfaceTypeChoices}
							value={state.selection.type === 'surfaceType' ? state.selection.surfaceType : ''}
							setValue={chooseSurfaceType}
							noOptionsMessage="No surface layouts are known yet"
						/>
					</div>

					{surfaceTypeChoices.length === 0 ? (
						<p className="grid-view-as-note">
							Companion learns how a surface is laid out when one is connected, so there is nothing to choose here until
							a surface has been plugged in. Surface support is installed from the module store.
						</p>
					) : (
						<>
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
										value={offset.columns}
										setValue={(columns) => setOffset({ rows: offset.rows, columns })}
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
										value={offset.rows}
										setValue={(rows) => setOffset({ rows, columns: offset.columns })}
									/>
								</div>
							</div>
						</>
					)}
				</>
			)}
		</>
	)
})
