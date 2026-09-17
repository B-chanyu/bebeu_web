$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$logRoot = if ($env:LOG_DIR) { $env:LOG_DIR } else { "C:\bebeyu\app_logs" }
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null

$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$stdout = Join-Path $logRoot "managed-server.out.log"
$stderr = Join-Path $logRoot "managed-server.err.log"

Start-Process `
  -FilePath $npm `
  -ArgumentList @("run", "serve:managed") `
  -WorkingDirectory $root `
  -WindowStyle Hidden `
  -RedirectStandardOutput $stdout `
  -RedirectStandardError $stderr

Write-Output "Managed bebeu server started in the background."
