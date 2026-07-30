import type { MetricsRegistry } from './Metrics.js'
import type { DataStoreBase, OperationObserver } from './StoreBase.js'

/**
 * Register the operation-duration histogram, returning a factory that binds it to a database name. Separate
 * from registerDatabaseMetrics because this histogram is push-based: its observer is injected into each store
 * at construction. Buckets are sub-millisecond-weighted, where these synchronous SQLite ops live.
 */
export function registerDatabaseDurationHistogram(
	metrics: MetricsRegistry
): (databaseName: string) => OperationObserver {
	const observe = metrics.labeledHistogram(
		'companion_database_operation_duration_seconds',
		'Duration of SQLite row-level operations, by database, table and operation kind',
		['database', 'table', 'operation'],
		[0.0001, 0.00025, 0.0005, 0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5]
	)
	return (databaseName) => (table, operation, seconds) => observe({ database: databaseName, table, operation }, seconds)
}

/**
 * Register the pull-based SQLite metrics (size, operation counts, errors, row counts) for a set of databases.
 * Kept next to the store layer rather than the central Metrics catalog as the collection is store-specific;
 * each reads live from DataStoreBase at scrape time. The duration histogram is registered separately above.
 */
export function registerDatabaseMetrics(
	metrics: MetricsRegistry,
	databases: { name: string; store: DataStoreBase<any> }[]
): void {
	// SQLite database size, one series per database. Sourced from SQLite's page accounting rather than a
	// filesystem stat, so it is portable and doesn't need file paths; it excludes the transient WAL file.
	// free_bytes is the reusable freelist portion of total_bytes, so bloat/fragmentation shows as the gap
	// between them (and what a VACUUM would reclaim).
	metrics.labeledGauge(
		'companion_database_size_bytes',
		'On-disk size of each SQLite database (page_count * page_size; excludes the transient WAL)',
		['database'],
		() =>
			databases.map(({ name, store }) => ({
				labels: { database: name },
				value: store.getDiskSizeInfo().totalBytes,
			}))
	)
	metrics.labeledGauge(
		'companion_database_free_bytes',
		'Reusable free space within each SQLite database (freelist_count * page_size)',
		['database'],
		() =>
			databases.map(({ name, store }) => ({
				labels: { database: name },
				value: store.getDiskSizeInfo().freeBytes,
			}))
	)

	// Per-table row-level operation counts. node:sqlite is synchronous, so these are a direct proxy for how
	// much the DB is stalling the event loop; broken out by database, table and operation kind.
	metrics.labeledCounter(
		'companion_database_operations_total',
		'Number of SQLite row-level operations, by database, table and operation kind',
		['database', 'table', 'operation'],
		() =>
			databases.flatMap(({ name, store }) =>
				store.getTableOperationStats().flatMap((stat) =>
					Object.entries(stat.counts).map(([operation, value]) => ({
						labels: { database: name, table: stat.table, operation },
						value,
					}))
				)
			)
	)
	metrics.labeledCounter(
		'companion_database_operation_errors_total',
		'Number of SQLite operations that threw, by database, table and operation kind (otherwise only warn-logged)',
		['database', 'table', 'operation'],
		() =>
			databases.flatMap(({ name, store }) =>
				store.getTableOperationStats().flatMap((stat) =>
					Object.entries(stat.errors).map(([operation, value]) => ({
						labels: { database: name, table: stat.table, operation },
						value,
					}))
				)
			)
	)
	metrics.labeledGauge(
		'companion_database_table_rows',
		'Number of rows in each SQLite table',
		['database', 'table'],
		() =>
			databases.flatMap(({ name, store }) =>
				store.getTableRowCounts().map(({ table, rows }) => ({
					labels: { database: name, table },
					value: rows,
				}))
			)
	)
}
