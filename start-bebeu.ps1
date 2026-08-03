$ErrorActionPreference = "Stop"

$v2Start = Join-Path $PSScriptRoot "bebeu\v2\start-bebeu.ps1"
if (-not (Test-Path -LiteralPath $v2Start)) {
  throw "v2 start script not found: $v2Start"
}

& $v2Start
