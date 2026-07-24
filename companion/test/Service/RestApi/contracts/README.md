# REST API stable contract

`openapi-stable.json` is the accepted public REST API contract. The normal test suite compares the generated OpenAPI document with this file and reports backwards-incompatible changes on every pull request.

When an intentional API change should become part of the stable contract:

1. Run `yarn rest-api:update-stable-contract` from the repository root.
2. Review the resulting contract diff and confirm that any breaking change is accompanied by the appropriate resource API version change.
3. Commit the contract update in a normal pull request so the compatibility check and the contract diff are visible during review.

Do not update the contract merely to make an unexpected compatibility failure pass.
