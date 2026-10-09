The new REST API replaces the old [HTTP Remote Control](../http-remote-control.md) with a proper API that exposes most functions that can be performed in the UI.

The OpenAPI Schema is available at `[companion url]/api/v2/openapi.json`.

Interactive docs can be accessed via `[companion url]/api/v2/docs`.

## Example: replacing an image

Buttons can show an image from the Image Library with the `$(image:<name>)` variable. Replacing the image data updates every button using it, without needing to edit the buttons:

```bash
curl -X PUT \
  -H "Authorization: Bearer $COMPANION_API_KEY" \
  -H "Content-Type: image/png" \
  --data-binary @logo.png \
  http://localhost:8000/api/v2/image-library/v1/logo/data
```

This needs an API key with the `write` scope, and the image must already exist. Create it in the Image Library, or with `POST /api/v2/image-library/v1`.
