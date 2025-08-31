# Backbundle

Zero-configuration bundler for Node.js backend applications based on esbuild.

## Features

- **Zero Configuration**: No config files needed, just run the CLI.
- **Fast**: Built on top of esbuild for lightning-fast builds.
- **Flexible**: Supports various frameworks like NestJS, Express, Koa, and Fastify.

## Usage

```bash
pnpm add -D backbundle
```

Add the following in your package.json scripts:

```json
{
  "scripts": {
    "build": "backbundle build --input src/index.ts --output dist/index.js"
  }
}
```