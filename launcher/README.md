## companion-launcher

This is the small 'launcher' window that shows when you run the desktop version of companion.

### Background

In 2.2 and earlier, this window was part of the same process as the rest of companion, but this resulted in it falling behind as a very outdated version of electron. This happened because updating electron often meant changing the version of node that companion was running with, and that would often break some modules.

In 2.3/3.0 and onwards, this window has been split off to be its own mini-application, which runs companion directly in a bundled version of nodejs, so that we can control the electron and nodejs versions separately. It also means that the way companion is run in the headless vs desktop builds is much closer, which should help ensure there arent issues unique to one flow

### Future

At some point in the future this launcher window should be rewritten in a different language/library/framework, as we do not need electron for such a small thing. It would be better to use something more native that wont be subject to the same security update requirements that electron has. This is not a priority as this setup works, and should be easy for more of the companion developer base to maintain.
