$ErrorActionPreference = "Stop"

$dataRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$photoRoot = Join-Path $dataRoot "bebeu_image"
$logRoot = Join-Path $dataRoot "app_logs"
if (-not (Test-Path -LiteralPath $photoRoot)) {
  New-Item -ItemType Directory -Path $photoRoot | Out-Null
}
if (-not (Test-Path -LiteralPath $logRoot)) {
  New-Item -ItemType Directory -Path $logRoot | Out-Null
}

if (-not $env:PHOTO_ROOT) { $env:PHOTO_ROOT = $photoRoot }
if (-not $env:LOG_DIR) { $env:LOG_DIR = $logRoot }
if (-not $env:PORT) { $env:PORT = "3000" }
if (-not $env:MYSQL_HOST) { $env:MYSQL_HOST = "127.0.0.1" }
if (-not $env:MYSQL_PORT) { $env:MYSQL_PORT = "3306" }
if (-not $env:MYSQL_USER) { $env:MYSQL_USER = "bebeu_user" }
if (-not $env:MYSQL_PASSWORD) { $env:MYSQL_PASSWORD = "" }
if (-not $env:MYSQL_DATABASE) { $env:MYSQL_DATABASE = "bebeu" }

$ip = (ipconfig | Select-String -Pattern "IPv4" | Select-Object -First 1).ToString().Split(":")[-1].Trim()

Write-Host ""
Write-Host "bebeu 작업앱 서버를 시작합니다."
Write-Host "PC에서 접속: http://localhost:3000"
if ($ip) {
  Write-Host "같은 와이파이 휴대폰에서 접속: http://$($ip):3000"
}
Write-Host "사진 저장 위치: $photoRoot"
Write-Host "데이터베이스: MariaDB bebeu"
Write-Host ""

node server.js
