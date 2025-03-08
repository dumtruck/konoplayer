set windows-shell := ["pwsh.exe", "-c"]
set dotenv-load := true

dev-playground:
    pnpm run --filter=playground dev

dev-proxy:
    pnpm run --filter=proxy dev