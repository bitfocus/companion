---
title: Modules
---

All the connections in Companion are modules, and a module is what's used to control an external device or piece of software. Modules used to be built-in to Companion, but starting with 4.0 they are downloadable plugins.

Modules are being added and updated all the time. A complete list of supported devices/modules can be found on the [Support List](https://bitfocus.io/connections) page.

Most of the modules are written and maintained by the community. If your device or software is missing from this list, there are a few things you can do:

1. If you have any experience writing code, you could make the module yourself, we are happy to accept all contributions. Read more [here](https://github.com/bitfocus/companion-module-base/wiki/Module-development-101)
2. Some members on the [Community forum](https://bfoc.us/qjk0reeqmy) are available to hire to implement modules.
3. While the Bitfocus team is small, they are available to implement some modules, [get in touch](https://bitfocus.io/about#intouch) for a price and delivery date.
4. You can also [ask the open source community](https://bfoc.us/5xcykgx03n) by submitting a request, and hope that someone is willing to do the work for you.

## Module List

In the left panel of the modules page you will find a list of the modules that you have installed into your Companion system.  
The table has some filters and is also searchable, so that you can control what is shown. Selecting a module in this table will open more details in the right panel.

The 'import module package' button lets you import a module package. This should be a `.tgz` file produced by building a single module, most likely distributed by the module author. With this, you can now easily import a test build of a module, or a module which is internal to your company or organisation.

The 'import offline module bundle' button can be used for the bulk importing of modules. On the [Bitfocus website](https://bitfocus.io/download), you can download an offline module bundle. This is intended for installations which are offline and cannot directly access the store. These bundles are versioned the same as Companion, so you can be sure that the modules contained will work with a specific version of Companion

## Managing a module

In this panel, you can manage the installed versions of a module.

By default the table shows all known stable versions, and indicates which are installed or not. For installed ones, the plug icon indicates that this version is in use by a connection.  
In the top right you can toggle showing beta versions of the module, as well as deprecated versions.

The 'refresh' button will refresh the module info from the store, in case there is a new version you wish to install. This gets performed on an interval too, so that we can indicate when new versions are available.

![Module versions](6_modules/images/manage.png)
