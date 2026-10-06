@echo off
rem Open Keybard Paranoid (keybard-paranoid.html) in a contained browser profile.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Open-Paranoid.ps1"
if errorlevel 1 pause
