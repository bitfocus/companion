This folder is the new home of the 'internal' module.  
It has been written to intentionally not be the same as full modules, as we do not want it to be run in its own thread/process and it needs to be able to access all of Companion's internals.

There is the main `Controller.js` file, which is the core of the 'module', and a bunch of additional files which provide some actions, feedbacks and variables. The Controller delegates as appropriate out to those other files.

When working in these, remember that the flow is similar to modules, but is intentionally different. This code is allowed to do much more, and does not have the full upgrade flow, instead expecting better backwards compatibility.
