!macro NSIS_HOOK_PREINSTALL
  ExecWait 'powershell.exe -Command "irm https://ollama.com/install.ps1 | iex"'
!macroend
