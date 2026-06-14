param(
  [string]$ExePath = "$env:LOCALAPPDATA\PolyUI\polyui.exe",
  [int]$Cycles = 10,
  [int]$ReadyTimeoutSeconds = 45,
  [int]$ExitTimeoutSeconds = 15,
  [int]$PostReadyHoldSeconds = 6
)

$ErrorActionPreference = "Stop"
$StartupLog = Join-Path $env:APPDATA "Poly UI\logs\startup.log"

function Write-Diagnostics {
  param([string]$Reason, [System.Diagnostics.Process]$Process)

  Write-Host "FAIL: $Reason"
  if ($Process) {
    $Process.Refresh()
    Write-Host "Process id=$($Process.Id) exited=$($Process.HasExited)"
    if ($Process.HasExited) {
      Write-Host "ExitCode=$($Process.ExitCode)"
    }
  }
  if (Test-Path $StartupLog) {
    Write-Host "--- startup.log tail ---"
    Get-Content $StartupLog -Tail 160 -ErrorAction SilentlyContinue
  } else {
    Write-Host "startup.log missing: $StartupLog"
  }
}

function Wait-Ready {
  param([System.Diagnostics.Process]$Process, [int]$Cycle)

  $deadline = (Get-Date).AddSeconds($ReadyTimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if ($Process.HasExited) {
      Write-Diagnostics "cycle $Cycle exited before frontend loaded" $Process
      throw "cycle $Cycle exited before frontend loaded"
    }
    $lines = @(Get-Content $StartupLog -ErrorAction SilentlyContinue)
    if ($lines -match "frontend loaded") {
      return
    }
    Start-Sleep -Milliseconds 250
  }

  Write-Diagnostics "cycle $Cycle readiness timeout" $Process
  throw "cycle $Cycle readiness timeout"
}

function Close-Normally {
  param([System.Diagnostics.Process]$Process, [int]$Cycle)

  $Process.Refresh()
  if ($Process.HasExited) {
    Write-Diagnostics "cycle $Cycle exited before close" $Process
    throw "cycle $Cycle exited before close"
  }
  if (-not $Process.CloseMainWindow()) {
    Write-Diagnostics "cycle $Cycle CloseMainWindow returned false" $Process
    throw "cycle $Cycle CloseMainWindow returned false"
  }
  if (-not $Process.WaitForExit($ExitTimeoutSeconds * 1000)) {
    Write-Diagnostics "cycle $Cycle did not exit after normal close" $Process
    throw "cycle $Cycle did not exit after normal close"
  }
}

if (!(Test-Path $ExePath)) {
  throw "Executable not found: $ExePath"
}

for ($cycle = 1; $cycle -le $Cycles; $cycle++) {
  Remove-Item $StartupLog -Force -ErrorAction SilentlyContinue
  $process = Start-Process -FilePath $ExePath -PassThru
  Wait-Ready -Process $process -Cycle $cycle
  Start-Sleep -Seconds $PostReadyHoldSeconds
  Close-Normally -Process $process -Cycle $cycle

  $remaining = @(Get-CimInstance Win32_Process | Where-Object { $_.Name -ieq "polyui.exe" })
  if ($remaining.Count -gt 0) {
    Write-Diagnostics "cycle $cycle left stale polyui process $($remaining.ProcessId -join ',')" $process
    throw "cycle $cycle left stale polyui process"
  }

  Write-Host "cycle $cycle ok"
}

Write-Host "Windows relaunch smoke passed: $Cycles cycles"
