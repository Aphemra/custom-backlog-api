Option Explicit

Dim fileSystem
Dim shell
Dim scriptDirectory
Dim powershellPath
Dim launcherPath
Dim command

Set fileSystem = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

scriptDirectory = fileSystem.GetParentFolderName(WScript.ScriptFullName)
powershellPath = shell.ExpandEnvironmentStrings("%SystemRoot%") & "\System32\WindowsPowerShell\v1.0\powershell.exe"
launcherPath = scriptDirectory & "\start-production.ps1"

command = """" & powershellPath & """ -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & launcherPath & """"

shell.Run command, 0, True