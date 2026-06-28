import { useAuthStore } from "@/store/authStore"
import { ProfileMenu } from "@/features/profile/ProfileMenu"
import { GuestFooter } from "@/features/sidebar/components/GuestFooter"
import type { SettingsTab } from "@/features/settings/SettingsModal"

interface NavUserProps {
  onOpenSettings: (tab?: SettingsTab) => void
}

export function NavUser({ onOpenSettings }: NavUserProps) {
  const isGuest = useAuthStore((s) => s.isGuest)

  if (isGuest) {
    return <GuestFooter onOpenSettings={onOpenSettings} />
  }

  return <ProfileMenu onOpenSettings={onOpenSettings} />
}
