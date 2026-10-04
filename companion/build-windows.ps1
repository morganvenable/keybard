$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    python -m pip install -r requirements.txt 'pyinstaller>=6.11,<7'
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' }
    python -m unittest discover -s tests -v
    if ($LASTEXITCODE -ne 0) { throw 'Companion tests failed' }
    python -m context_companion --smoke-test
    if ($LASTEXITCODE -ne 0) { throw 'UI smoke test failed' }
    python -m PyInstaller --noconfirm --clean --onedir --windowed --name KeybardContext --hidden-import hid launcher.py
    if ($LASTEXITCODE -ne 0) { throw 'Windows packaging failed' }
    Copy-Item -Recurse -Force browser-extension dist/KeybardContext/browser-extension
    Copy-Item README.md dist/KeybardContext/README.md
    Copy-Item -Recurse -Force examples dist/KeybardContext/examples
    @{
        application = 'Keybard Context — layer switching draft'
        source_commit = $env:GITHUB_SHA
        built_at_utc = [DateTime]::UtcNow.ToString('o')
        firmware_branch = 'feat/context-layers'
        hardware = 'Svalboard PMW3389 (choose the USB-connected side)'
    } | ConvertTo-Json | Set-Content -Encoding utf8 dist/KeybardContext/build-info.json
    $env:KEYBARD_CONTEXT_SMOKE = '1'
    try {
        $process = Start-Process -FilePath "$PSScriptRoot/dist/KeybardContext/KeybardContext.exe" -ArgumentList '--smoke-test' -PassThru
        if (-not $process.WaitForExit(40000)) { $process.Kill(); throw 'Packaged UI smoke test timed out' }
        if ($process.ExitCode -ne 0) { throw "Packaged UI smoke test failed ($($process.ExitCode))" }
    } finally { Remove-Item Env:KEYBARD_CONTEXT_SMOKE -ErrorAction SilentlyContinue }
    Compress-Archive -Force -Path dist/KeybardContext -DestinationPath dist/KeybardContext-Windows.zip
    Get-FileHash -Algorithm SHA256 dist/KeybardContext-Windows.zip | ForEach-Object {
        "$($_.Hash.ToLower())  KeybardContext-Windows.zip"
    } | Set-Content -Encoding ascii dist/SHA256SUMS.txt
} finally { Pop-Location }
