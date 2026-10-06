# Open keybard-paranoid.html in a contained Chrome/Edge profile: a dead proxy blocks
# every non-loopback request (navigations included), WebRTC stays off the network
# and background browser services are off. Keep flags in sync with keybard_host/browser.py.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$file = Join-Path $root 'keybard-paranoid.html'
if (-not (Test-Path -LiteralPath $file)) { throw 'keybard-paranoid.html was not found next to Open-Paranoid.cmd.' }
$candidates = @(
    (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
    (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe'),
    (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe')
)
$browser = $candidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
if (-not $browser) { throw 'Keybard Paranoid needs Google Chrome or Microsoft Edge.' }
$profile = Join-Path $env:LOCALAPPDATA 'Keybard Host\paranoid-browser-profile'
$url = ([Uri]$file).AbsoluteUri
$flags = @(
    "--user-data-dir=`"$profile`"",
    '--proxy-server=http://127.0.0.1:9',
    '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
    '--disable-background-networking',
    '--disable-sync',
    '--disable-component-update',
    '--no-first-run',
    '--no-default-browser-check',
    "--app=$url"
)
Start-Process -FilePath $browser -ArgumentList $flags
