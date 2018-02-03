@echo off

:: Test for ability to run python
where /q python
if ERRORLEVEL 1 (
    echo Python is not in your PATH environment variable. Please re-run the Python
	echo installer and make sure 'Add python.exe to Path' is enabled in the 'Customize
	echo Python' page of the installer.
	pause
	exit /b
)

:: Test if we can find server.py and whether we might be running from a UNC path
if not exist "server.py" (
  if /I "%CD%" == "%WINDIR%" (
    echo.
    echo It is likely that you have run server.bat from an Explorer window that is
	echo pointed at a UNC path ^(that is, one that starts with two \\^). The windows
	echo command prompt does not support UNC paths. If the UNC path corresponds to a
	echo mapped drive, open an Explorer window to the mapped drive letter and try
	echo again. It is recommended that you unzip Vis-Tools to a local ^(non-network^)
	echo location for best performance.
  ) else (
    echo.
    echo The server python file, server.py, is not present in the current directory.
	echo Please re-install Vis-Tools to a local ^(non-network^) location and try again.
  )
  pause
  exit /b
)

:: Prereqs check, run the server
python server.py
pause
