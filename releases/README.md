# Windows installers

| Version | Files | SHA-256 of the joined installer |
|---|---|---|
| 0.15.1 | `Fembroider-Setup-0.15.1-x64.exe.part0` + `.part1`, `join-0.15.1.bat` | `a9d8e89bfe3f5d2e6a12b095f3b5bcb6cb42b93710846bc25bd85847ed40ac7f` |

GitHub refuses single files over 100 MB, so the 113 MB installer is stored in two parts. To get the installer:

1. Download both `.part0` and `.part1` (each file's **Download raw file** button) and `join-0.15.1.bat` into one
   folder, or clone the repository.
2. Double-click `join-0.15.1.bat`. It writes `Fembroider-Setup-0.15.1-x64.exe` next to the parts and checks its
   SHA-256. By hand: `copy /b Fembroider-Setup-0.15.1-x64.exe.part0 + Fembroider-Setup-0.15.1-x64.exe.part1 Fembroider-Setup-0.15.1-x64.exe`
   (Windows) or `cat *.part0 *.part1 > Fembroider-Setup-0.15.1-x64.exe` (macOS / Linux).

The installer is not code-signed yet, so Windows SmartScreen warns "Windows protected your PC" before the first run
(More info → Run anyway). It upgrades an existing Stitch Studio install in place.
