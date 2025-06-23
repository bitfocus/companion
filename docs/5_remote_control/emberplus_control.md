The following controls are available via emberplus:

| Companion Product Information |                                             |
| ----------------------------- | ------------------------------------------- |
| Path:                         | `/Companion Tree/identity/<parameter name>` |
| Permissions:                  | `Read Only`                                 |
| Parameters:                   | `product`, `company`, `version`, `build`    |
| Parameter Types:              | `string`                                    |

| Button Manipulation |                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------- |
| Path:               | `/Companion Tree/pages/<page name>/<button number>/<parameter name>`                   |
| Path:               | `/Companion Tree/location/<page number>/<row number>/<column number>/<parameter name>` |
| Permissions:        | `Read/Write`                                                                           |
| Parameters:         | `State`, `Label`, `Text_Color`, `Background_Color`                                     |
| Parameter Types:    | `boolean`, `string`                                                                    |

| Internal Variables |                                                                        |
| ------------------ | ---------------------------------------------------------------------- |
| Path:              | `/Companion Tree/variables/internal/<parameter name>/<parameter type>` |
| Permissions:       | `Read Only`                                                            |
| Parameter Types:   | `boolean`, `integer`, `string`                                         |

| Custom Variables |                                                            |
| ---------------- | ---------------------------------------------------------- |
| Path:            | `/Companion Tree/variables/custom/<parameter name>/string` |
| Permissions:     | `Read/Write`                                               |
| Parameter Types: | `string`                                                   |

| Action Recorder  |                                                    |
| ---------------- | -------------------------------------------------- |
| Path:            | `/Companion Tree/action recorder/<parameter name>` |
| Permissions:     | `Read/Write`                                       |
| Parameters:      | `Enable`, `Discard`                                |
| Parameter Types: | `boolean`                                          |

---

**Provider Restarts**

The Ember Plus provider will automatically restart to rebuild the ember tree under the following conditions:

- Page count change
- Button matrix size change
- Adding new connections
- Changing the label of a connection
- Adding new custom variables

This will disconnect clients and should be avoided during production use.

**Node path stability**

The Ember Plus server cannot guarantee the stability of the numerical paths to variables between Companion restarts, as this is contingent upon initialization order.
Whenever possible one should preference use of textual paths such as `Companion Tree/variables/internal/instance_warns` rather than `0.3.1.3` as these are stable. After significant changes a full Companion restart can help stabilize the numeric paths.
