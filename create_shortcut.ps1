$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [System.Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $DesktopPath "SundaySchoolApp.lnk"
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "c:\Users\MIBE SHAK\OneDrive\Documents\Custom Office Templates\sunday-school-app\run_app.bat"
$Shortcut.WorkingDirectory = "c:\Users\MIBE SHAK\OneDrive\Documents\Custom Office Templates\sunday-school-app"
$Shortcut.Save()
Write-Host "Shortcut created successfully on Desktop!"
