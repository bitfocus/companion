Care must be taken when editing these types

Many are used for the ui, the db and exports, so any changes to these can cause imports or user databases to no longer match up.

Be sure to make all changes in a backwards compatible way, or if the change is large enough it should increment the db revision and use an upgrade script to convert the previous version into the new one.
