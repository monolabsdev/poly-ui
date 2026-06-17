import { idleManager } from './manager'
import { getHealthMonitor } from '@/features/ollama/health-monitor'
import { startUpdateChecker, stopUpdateChecker } from '@/store/updateStore'
import { registerDictationOffload } from './dictation'
import { registerMemoryPurge } from './purge'

export function registerDefaultIdleHandlers(): void {
  const hm = getHealthMonitor()

  idleManager.register('health-monitor', {
    onPause: () => hm.stop(),
    onResume: () => { hm.start(); hm.refresh() },
    priority: 10,
  })

  idleManager.register('update-checker', {
    onPause: () => stopUpdateChecker(),
    onResume: () => startUpdateChecker(),
    priority: 5,
  })

  registerDictationOffload()
  registerMemoryPurge()
}
