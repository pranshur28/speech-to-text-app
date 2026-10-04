# Installs (or updates) Speech to Text from the latest GitHub release.
#
#   irm https://raw.githubusercontent.com/pranshur28/speech-to-text-app/main/install.ps1 | iex
#
# Works in Windows PowerShell 5.1 and PowerShell 7. Installs per-user, no admin needed.
# Settings, history and dictionary are kept when updating.

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'  # the progress bar makes downloads far slower in 5.1
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$repo = 'pranshur28/speech-to-text-app'
$appName = 'Speech to Text'

Write-Host "Finding the latest $appName release..."
$release = Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest" -Headers @{ 'User-Agent' = 'speech-to-text-installer' }
$asset = $release.assets | Where-Object { $_.name -like '*Setup*.exe' } | Select-Object -First 1
if (-not $asset) { throw "No installer found in release $($release.tag_name)." }

$installer = Join-Path $env:TEMP $asset.name
Write-Host "Downloading $($asset.name) ($([math]::Round($asset.size / 1MB)) MB)..."
Invoke-WebRequest $asset.browser_download_url -OutFile $installer

# The installer can't replace files that are in use
$running = Get-Process -Name $appName -ErrorAction SilentlyContinue
if ($running) {
    Write-Host "Closing the running $appName..."
    $running | Stop-Process -Force
    Start-Sleep -Seconds 1
}

Write-Host "Installing $($release.tag_name)..."
Start-Process -FilePath $installer -ArgumentList '/S' -Wait
Remove-Item $installer -ErrorAction SilentlyContinue

$exe = Join-Path $env:LOCALAPPDATA "Programs\$appName\$appName.exe"
if (-not (Test-Path $exe)) { throw "Install finished but $exe was not found." }

Write-Host "Installed $appName $($release.tag_name). Starting it..."
Start-Process -FilePath $exe
Write-Host "On first run, add your Deepgram API key in Settings."
