import React, { useCallback, useContext } from 'react'
import { CButton, CCol, CRow } from '@coreui/react'
import { PagesContext } from '../util'

interface PagesListProps {
	setPageNumber: (page: number) => void
}

export function PagesList({ setPageNumber }: PagesListProps): JSX.Element {
	const pages = useContext(PagesContext)

	const goToPage = useCallback(
		(e: React.MouseEvent<HTMLButtonElement>) => {
			const page = Number(e.currentTarget.getAttribute('data-page'))
			if (!isNaN(page)) {
				setPageNumber(page)
			}
			console.log(page)
		},
		[setPageNumber]
	)

	return (
		<CRow>
			<CCol xs={12}>
				<table className="table table-responsive-sm">
					<thead>
						<tr>
							<th>NO</th>
							<th>Name</th>
							<th>&nbsp;</th>
						</tr>
					</thead>
					<tbody>
						{Object.entries(pages).map(([id, info]) => (
							<tr key={id}>
								<td>
									<CButton color="primary" variant="ghost" onClick={goToPage} data-page={id}>
										{id}
									</CButton>
								</td>
								<td>{info?.name ?? ''}</td>
								<td></td>
							</tr>
						))}
					</tbody>
				</table>
			</CCol>
		</CRow>
	)
}
