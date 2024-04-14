@echo off
del /q bin\*.zip
for /f "usebackq tokens=2 delims=:" %%a in (`type manifest.json ^| findstr /C:"\"name\":" /C:"\"version\":"`) do (
    for /f "tokens=*" %%n in ("%%~a") do (
        if not defined name (
            set "name=%%~n"
        ) else (
            set "version=%%~n"
        )
    )
)
set name=%name:"=%
set version=%version:"=%
set version=%version:,=%
set name=%name: =_%
set name=%name:,=%
echo %name%-%version%.zip
powershell Compress-Archive -Path * -DestinationPath "bin\%name%_%version%.zip"