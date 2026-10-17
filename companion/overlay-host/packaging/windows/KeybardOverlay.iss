; Keybard Overlay installer (Inno Setup 6). Built by build.py, which passes the
; version and paths below. Installs per user: no administrator prompt.

#ifndef AppVersion
  #define AppVersion "0.0.0-dev"
#endif
#ifndef NumericVersion
  #define NumericVersion "0.0.0.0"
#endif
#ifndef SourceDir
  #define SourceDir "..\..\..\..\build-windows\dist\Keybard Overlay"
#endif
#ifndef ParanoidFile
  #define ParanoidFile "..\..\..\..\dist-paranoid\keybard-paranoid.html"
#endif
#ifndef IconFile
  #define IconFile "..\..\keybard_host\assets\svalboard.ico"
#endif
#ifndef OutputDir
  #define OutputDir "..\..\..\..\build-windows"
#endif

[Setup]
; AppId is unchanged from the Keybard Host installer, so this one upgrades it in place.
AppId={{9D3A0B6E-5C1F-4B7A-9E2D-8F4C6A1B3D57}
AppName=Keybard Overlay
AppVersion={#AppVersion}
AppVerName=Keybard Overlay {#AppVersion}
AppPublisher=Svalboard
AppPublisherURL=https://keybard.svalboard.com
AppSupportURL=https://github.com/svalboard/keybard
DefaultDirName={localappdata}\Programs\Keybard Overlay
DefaultGroupName=Keybard
DisableProgramGroupPage=yes
DisableDirPage=auto
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputDir={#OutputDir}
OutputBaseFilename=KeybardOverlaySetup
SetupIconFile={#IconFile}
UninstallDisplayIcon={app}\Keybard Overlay.exe
UninstallDisplayName=Keybard Overlay
VersionInfoVersion={#NumericVersion}
VersionInfoProductName=Keybard Overlay
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
; Close a running Keybard Overlay before replacing or removing its files.
CloseApplications=force
RestartApplications=no
#ifdef Sign
; Signs the installer and its uninstaller with the command build.py passes as /Skeybard=.
SignTool=keybard
SignedUninstaller=yes
#endif

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; Flags: unchecked
Name: "startup"; Description: "Start Keybard Overlay when I sign in"; Flags: unchecked

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#ParanoidFile}"; DestDir: "{app}"; Flags: ignoreversion

[InstallDelete]
; The app was called Keybard Host before. Remove that name's program and shortcuts on upgrade.
Type: files; Name: "{app}\Keybard Host.exe"
Type: files; Name: "{group}\Keybard Host.lnk"
Type: files; Name: "{group}\Keybard Host (Paranoid).lnk"
Type: files; Name: "{group}\Uninstall Keybard Host.lnk"
Type: files; Name: "{userdesktop}\Keybard Host.lnk"
Type: files; Name: "{userstartup}\Keybard Host.lnk"

[Icons]
Name: "{group}\Keybard Overlay"; Filename: "{app}\Keybard Overlay.exe"; Comment: "Shows your Svalboard layout above your other windows"
Name: "{group}\Keybard Overlay (Paranoid)"; Filename: "{app}\Keybard Overlay.exe"; Parameters: "--paranoid"; Comment: "Keybard Paranoid with the overlay; accepts no websites"
Name: "{group}\Keybard Paranoid (offline)"; Filename: "{app}\Keybard Overlay.exe"; Parameters: "--open-file ""{app}\keybard-paranoid.html"""; Comment: "Keybard as a local file in a contained browser, without the overlay"
Name: "{group}\Uninstall Keybard Overlay"; Filename: "{uninstallexe}"
Name: "{userdesktop}\Keybard Overlay"; Filename: "{app}\Keybard Overlay.exe"; Tasks: desktopicon
Name: "{userstartup}\Keybard Overlay"; Filename: "{app}\Keybard Overlay.exe"; Parameters: "--no-open"; Tasks: startup

[Run]
Filename: "{app}\Keybard Overlay.exe"; Description: "Start Keybard Overlay now"; Flags: nowait postinstall skipifsilent
