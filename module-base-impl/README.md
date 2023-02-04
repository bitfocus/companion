# @companion-module/base-impl

This provides an implementation of the `CompanionInstanceApi` interface and `InternalApiGenerator` function defined in `@companion-module/base`.

To minimise the amount of Companion code that is bundled into each module, `@companion-module/base` is loading a javascript file with a path defined from an environment variable, and using that as the basis for execution.

The benefit of this approach is that it lets us update some of the code that runs inside the module as part of Companion, rather than requring the modules to be rebuilt and updated.

The `CompanionInstanceApi` interface is the new stable API, and needs to be kept version safe, to allow for the cross version support that `@companion-module/base` introduced
