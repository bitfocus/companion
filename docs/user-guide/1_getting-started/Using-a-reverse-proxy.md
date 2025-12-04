---
title: Advanced setup options
sidebar_label: Advanced setup options
sidebar_position: 10
description: Prepare hardware and software before launching Companion.
---

:::tip

This page discusses advanced options that are rarely needed. If you're not sure, it should be safe to ignore this page!

:::

## Setting up a Reverse Proxy

In rare instances, you may need to serve companion through a reverse proxy.

> If you have an example for another reverse proxy, feel free to open a github issue to get it added here.

Generally, there is nothing special needed for this other than ensuring that websockets are handled, a complete nginx config is:

```
	location / {
		proxy_pass http://127.0.0.1:8000/;

		proxy_set_header Host $http_host;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto $scheme;

		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection "upgrade";

		resolver 127.0.0.11;
	}
```

### Under a subpath

In some circumstances, you may want to host it under a subpath instead of at the root of the domain.  
As of **Companion 4.1** this is now possible. It is not widely used, so it is possible that occasionally new features will forget to consider this use case. If you find an issue like this, open an issue and we will happily fix it

```
location /my-subpath-here/ {
		proxy_set_header Companion-custom-prefix "my-subpath-here";
		proxy_pass http://127.0.0.1:8000/;

		proxy_set_header Host $http_host;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto $scheme;

		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection "upgrade";

		resolver 127.0.0.11;
}
```
