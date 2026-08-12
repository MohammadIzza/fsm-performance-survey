$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$logRoot = Join-Path $projectRoot '.local-server'
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
$nodePath = (Get-Command node).Source
$process = Start-Process -FilePath $nodePath -ArgumentList 'node_modules/astro/bin/astro.mjs', 'dev', '--background', '--host', '127.0.0.1', '--port', '4321' -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logRoot 'dev.out.log') -RedirectStandardError (Join-Path $logRoot 'dev.err.log') -Wait -PassThru
if ($process.ExitCode -ne 0) { throw 'Server failed to start. Check .local-server/dev.err.log.' }
Get-Content -LiteralPath (Join-Path $logRoot 'dev.out.log')
