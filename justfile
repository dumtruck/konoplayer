set windows-shell := ["pwsh.exe", "-c"]
set dotenv-load := true

dev-playground:
    pnpm run --filter=@konoplayer/playground dev

dev-proxy:
    pnpm run --filter=@konoplayer/proxy --filter=@konoplayer/mock dev

download-samples:
    pnpm run download-samples