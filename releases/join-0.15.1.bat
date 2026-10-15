@echo off
rem Joins the two parts into the Fembroider installer and checks it.
cd /d "%~dp0"
copy /b Fembroider-Setup-0.15.1-x64.exe.part0 + Fembroider-Setup-0.15.1-x64.exe.part1 Fembroider-Setup-0.15.1-x64.exe >nul
certutil -hashfile Fembroider-Setup-0.15.1-x64.exe SHA256 | findstr /i "a9d8e89bfe3f5d2e6a12b095f3b5bcb6cb42b93710846bc25bd85847ed40ac7f" >nul && (echo Installer ready: Fembroider-Setup-0.15.1-x64.exe) || (echo Checksum mismatch: download both parts again.)
pause
