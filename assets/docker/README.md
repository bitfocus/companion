# Bitfocus Companion

Companion enables the reasonably priced Elgato Stream Deck and other control surfaces to control a
wide range of professional AV hardware and software. This image runs the headless Companion server
for `linux/amd64` and `linux/arm64`.

- Website & docs: https://companion.free
- Source: https://github.com/bitfocus/companion
- Supported devices/software (700+): https://bitfocus.io/connections

## Quick start

```sh
docker run -d --name companion \
  -p 8000:8000 -p 16622:16622 -p 16623:16623 \
  -v companion-config:/companion \
  ghcr.io/bitfocus/companion/companion:latest
```

Then open http://localhost:8000.

### docker-compose

```yaml
services:
  companion:
    image: ghcr.io/bitfocus/companion/companion:latest
    restart: unless-stopped
    ports:
      - '8000:8000' # Admin UI
      - '16622:16622' # Companion Satellite (TCP)
      - '16623:16623' # Companion Satellite (WS)
    volumes:
      - companion-config:/companion
volumes:
  companion-config:
```

## Data & ports

- Bind a volume to `/companion` so your configuration (and the `config.yaml` below) is persisted.
- Ports: `8000` admin UI, `16622`/`16623` the Companion Satellite API. Modules may open further
  inbound ports, so plan for this with the network mode you use.

## Configuration

Launch options are configured through `/companion/config.yaml`, inside the mounted volume. On first
start a commented file is created for you. Edit it and restart the container to apply changes. See
the full list of options in the
[configuration reference](https://companion.free/user-guide/beta/getting-started/config-reference).

`COMPANION_ADMIN_PORT` (default `8000`) is honoured on first start and used by the container health
check; change the admin port in `config.yaml` and update your published ports to match.

USB passthrough is not supported. To connect Stream Decks or other surfaces from this or another
machine, use [Companion Satellite](https://github.com/bitfocus/companion-satellite).

Full documentation: https://companion.free/user-guide
