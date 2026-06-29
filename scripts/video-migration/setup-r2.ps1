$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $root "..\..")

Write-Host "Creating R2 buckets (ok if they already exist)..."
npx wrangler r2 bucket create hll-climb-videos 2>$null
npx wrangler r2 bucket create hll-climb-videos-preview 2>$null

Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Create an R2 API token in the Cloudflare dashboard"
Write-Host "  2. Copy scripts/video-migration/.env.example to .env and fill in credentials"
Write-Host "  3. cd scripts/video-migration && npm install"
Write-Host "  4. Run the migration scripts (see scripts/video-migration/README.md)"
Write-Host "  5. npm run deploy  (ensures VIDEOS_R2 binding is live)"
