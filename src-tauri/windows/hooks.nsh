!macro NSIS_HOOK_POSTINSTALL
  ExecWait '"powershell.exe" -ExecutionPolicy Bypass -NoProfile -File "$INSTDIR\windows\install-ollama.ps1"' $0
  StrCmp $0 0 +2
  MessageBox MB_ICONSTOP "Ollama installation failed (exit code $0).$\r$\nInstall manually from https://ollama.com"
!macroend
