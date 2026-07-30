This folder is the new home of the 'internal' module.  
It has been written to intentionally not be the same as full modules, as we do not want it to be run in its own thread/process and it needs to be able to access all of Companion's internals.

There is the main `Controller.js` file, which is the core of the 'module', and a bunch of additional files which provide some actions, feedbacks and variables. The Controller delegates as appropriate out to those other files.

When working in these, remember that the flow is similar to modules, but is intentionally different. This code is allowed to do much more, and does not have the full upgrade flow, instead expecting better backwards compatibility.

## Feedback evaluation: eager cache vs lazy at execution

Most internal feedbacks are evaluated **eagerly**: `Controller.ts` computes their value whenever an input changes and pushes it into the control's feedback cache (`#cachedFeedbackValue`). Rendering, boolean logic and local variables all read that cache.

Internal feedbacks that are **children of an action** (today the `condition` of `logic_if` / `logic_while`) are the exception - they are evaluated **lazily**, at action-execution time, rather than being cached. This lets the action inject execution-context `$(this:*)` variables (see `buildActionExecutionOverrides` in `Controller.ts`) into the feedback's option parsing.

Both paths go through the one routine `InternalController.#computeFeedbackValue`; the eager path (`#feedbackGetValue`) builds a plain parser, while the lazy path (`evaluateFeedbackValue`, reached from `ControlEntityInstance.getBooleanFeedbackValue(context)`) is handed a parser carrying the action's overrides. A `null` context means "use the cache". Whether a feedback is cached or lazy is tracked by `insideActionSubtree` on the entity, which is kept correct when entities are moved between lists.
