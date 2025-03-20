import { EventEmitter } from 'events'
import LogController, { Logger } from '../Log/Controller.js'
import type { AppInfo, Registry } from '../Registry.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import type { SurfaceController } from '../Surface/Controller.js'
import type { ServiceController } from '../Service/Controller.js'
import type { UIHandler } from '../UI/Handler.js'
import type { GraphicsController } from '../Graphics/Controller.js'
import type { DataDatabase } from '../Data/Database.js'
import type { ControlsController } from '../Controls/Controller.js'

type EventMap<T> = Record<keyof T, any[]> | [never]

/**
 * Abstract class to be extended by most core classes.  Provides access to the
 * {@link Registry} and other core modules.
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @since 2.3.0
 * @copyright 2022 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 */
export abstract class CoreBase<TEvents extends EventMap<TEvents> = never> extends EventEmitter<TEvents> {
	/**
	 * The application core
	 */
	readonly #registry: Registry

	/**
	 * The logger for this class
	 */
	protected readonly logger: Logger

	/**
	 * This needs to be called in the extending class
	 * using <code>super(registry, 'module_name', 'module_path')</code>.
	 * @param registry - the application core
	 * @param debugNamespace - module path to be used in the debugger
	 */
	constructor(registry: Registry, debugNamespace: string) {
		super()

		this.#registry = registry

		this.logger = LogController.createLogger(debugNamespace)
	}

	protected get appInfo(): AppInfo {
		return this.#registry.appInfo
	}

	/**
	 * The core controls controller
	 * TODO: make protected/private
	 */
	protected get controls(): ControlsController {
		return this.#registry.controls
	}

	/**
	 * The core database library
	 */
	protected get db(): DataDatabase {
		return this.#registry.db
	}

	/**
	 * The core graphics controller
	 */
	protected get graphics(): GraphicsController {
		return this.#registry.graphics
	}

	/**
	 * The core interface client
	 * TODO: make protected/private
	 */
	protected get io(): UIHandler {
		return this.#registry.io
	}

	/**
	 * The core page controller
	 * TODO: make protected/private
	 */
	protected get page() {
		return this.#registry.page
	}

	/**
	 * The core service controller
	 */
	protected get services(): ServiceController {
		return this.#registry.services
	}

	/**
	 * The core device controller
	 */
	protected get surfaces(): SurfaceController {
		return this.#registry.surfaces
	}

	/**
	 * The core user config manager
	 */
	protected get userconfig(): DataUserConfig {
		return this.#registry.userconfig
	}
}
