# @companion-module/base

This module provides the base class and framework needed to write a module for [Companion 3.0](https://github.com/bitfocus/companion) and later in NodeJS.

It is possible to write a module in other languages, but it is not recommended as it will reduce the change of gettings other in the community to contribute features and fixes. Additionally, there is not yet any tooling for other languges so you will be on your own. If you do go this way, then reach out and we can work together on creating a @companion-module/base for the language you are using.

## Upgrading a module built for Companion 2.x

### Background

In Companion 3.0, we rewrote the module-api from scratch. We chose to do this because the old api had grown very organically over 5 years, and was starting to show various issues. The main issues was modules were running in the main companion thread, and method signatures were assuming various calls to be synchronous, and modules being able to access various internals of companion (and some making concerningly large use of that ability).  
Rather than trying to quickly fix up the api, it was decided to rethink it entirely.

The general shape of the api should be familiar, but many methods names have been changed, and the whole api is written to rely on promises a lot more when before either callbacks were abused or methods would be synchronous.

Technology has also evolved since many of the modules were written, with many of them using js syntax that was superseded in 2015! As part of this overhaul, we have imposed some minimum requirements for tooling and code style. This shouldnt be an issue, but if you run into any issues let us know on slack and we will help you out.

### First steps

You no longer need a developer version of companion to develop your module! It can now be done with the version you usually run, or you can keep to the old way if you prefer, but you shall have to refer to the main application development guides for getting that setup and running again.

TODO - enable developer features
TODO - is there a log they can view?

You can now clone or move or existing clone into the folder you specified for development modules. Once you have done this, launch companion and it should get stuck trying to start the instance and failing, as your code is currently broken.

1. TODO

TODO

## Getting started

To get started with creating a new module, you should start with one of the following templates. These should be kept up to date, but you should make sure all the dependencies are up to date before you begin.

- TODO
