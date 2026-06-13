!macro NSIS_HOOK_PREINSTALL
  !insertmacro CheckIfAppIsRunning "${MAINBINARYNAME}.exe" "${PRODUCTNAME}"

  ReadRegStr $R0 SHCTX "${UNINSTKEY}" "UninstallString"
  ${If} $R0 != ""
    ReadRegStr $R1 SHCTX "${MANUPRODUCTKEY}" ""
    ${If} $R1 != ""
      ExecWait '"$R0" /S _?=$R1' $R2
    ${EndIf}
  ${EndIf}

  ; Clean up app data so fresh install doesn't inherit stale DB/state
  SetShellVarContext current
  RmDir /r "$APPDATA\${BUNDLEID}"
  RmDir /r "$LOCALAPPDATA\${BUNDLEID}"
!macroend

!macro NSIS_HOOK_POSTINSTALL
  IfFileExists "$INSTDIR\windows\install-ollama.ps1" 0 +4
  ExecWait '"powershell.exe" -ExecutionPolicy Bypass -NoProfile -File "$INSTDIR\windows\install-ollama.ps1"' $0
  StrCmp $0 0 +2
  MessageBox MB_ICONSTOP "Ollama installation failed (exit code $0).$\r$\nInstall manually from https://ollama.com"
!macroend
