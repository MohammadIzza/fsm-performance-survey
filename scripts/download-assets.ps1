$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$publicRoot = [IO.Path]::GetFullPath((Join-Path $projectRoot 'public'))
$assetMap = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'asset-downloads.json') -Raw | ConvertFrom-Json
foreach ($asset in $assetMap.PSObject.Properties) {
  $destination = [IO.Path]::GetFullPath((Join-Path $projectRoot $asset.Value))
  if (-not $destination.StartsWith($publicRoot + [IO.Path]::DirectorySeparatorChar)) { throw 'Asset path outside public directory' }
  if (Test-Path -LiteralPath $destination) { continue }
  New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
  curl.exe --fail --location --silent --show-error --max-time 45 $asset.Name --output $destination
  if ($LASTEXITCODE -ne 0) { throw "Failed to download $($asset.Name)" }
  Write-Output $asset.Value
}
