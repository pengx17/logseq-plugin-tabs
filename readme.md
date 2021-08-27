# Logseq Plugin Template React

## Features

- plug & play boilerplate
- develop with HMR, empowered by lightning fast Vite ⚡
- windicss for styling
- pnpm

### How HMR works?

See vite.config.ts. There is a custom plugin that will write a dev only index.html.
The index.html will

- change its base to `http://${config.server.host}:${config.server.port}`
- attach `/@vite/client` (allows error overlay and connect HMR ws)
- register react-refresh preamble code
