import { useEffect, useMemo, useState } from "react";
import { Avatar, Box, Button, Stack, TextField, Typography } from "@mui/material";
import { Lock, Save } from "lucide-react";
import { SectionHeader, SettingCard, EmptyState } from "../SettingComponents";
import { appTextFieldSx } from "@/components/ui/appDialog";
import { useNotify } from "@/hooks/useNotify";
import { useAuthStore } from "@/store/authStore";
import { useShallow } from "zustand/react/shallow";

function isValidEmail(value: string) {
  const trimmed = value.trim();
  return (
    trimmed.length > 3 &&
    trimmed.length <= 254 &&
    trimmed.includes("@") &&
    !trimmed.startsWith("@") &&
    !trimmed.endsWith("@") &&
    !/\s/.test(trimmed)
  );
}

function isValidAvatarUrl(value: string) {
  const trimmed = value.trim().toLowerCase();
  return trimmed === "" || trimmed.startsWith("https://") || trimmed.startsWith("http://");
}

function initialsFor(name: string, email: string) {
  const source = name.trim() || email.trim();
  return source ? source[0]?.toUpperCase() : "U";
}

export function ProfileTab() {
  const notify = useNotify();
  const { user, isGuest, isLoading, actions } = useAuthStore(
    useShallow((state) => ({
      user: state.user,
      isGuest: state.isGuest,
      isLoading: state.isLoading,
      actions: state.actions,
    })),
  );
  const [displayName, setDisplayName] = useState(user?.fullName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    setDisplayName(user?.fullName ?? "");
    setEmail(user?.email ?? "");
    setAvatarUrl(user?.avatarUrl ?? "");
  }, [user?.avatarUrl, user?.email, user?.fullName]);

  const profileError = useMemo(() => {
    if (!isValidEmail(email)) return "Enter a valid email address.";
    if (!isValidAvatarUrl(avatarUrl)) return "Use an http or https profile picture URL.";
    return null;
  }, [avatarUrl, email]);

  const passwordError = useMemo(() => {
    if (newPassword && (newPassword.length < 8 || newPassword.length > 128)) {
      return "New password must be 8 to 128 characters.";
    }
    if (confirmPassword && newPassword !== confirmPassword) return "Passwords do not match.";
    return null;
  }, [confirmPassword, newPassword]);

  if (!user || isGuest) {
    return <EmptyState>Profile settings are available after sign in.</EmptyState>;
  }

  const saveProfile = async () => {
    if (profileError) return;
    setProfileSaving(true);
    try {
      await actions.updateProfile({
        email: email.trim(),
        fullName: displayName.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
      });
      notify.success("Profile updated");
    } catch (err) {
      notify.error("Profile update failed", String(err));
    } finally {
      setProfileSaving(false);
    }
  };

  const savePassword = async () => {
    if (passwordError || !currentPassword || !newPassword) return;
    setPasswordSaving(true);
    try {
      await actions.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      notify.success("Password changed");
    } catch (err) {
      notify.error("Password change failed", String(err));
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <Stack spacing={0}>
      <SectionHeader
        title="Profile"
        description="Manage how your account appears in Poly UI."
      />

      <SettingCard
        title="Identity"
        description="These details stay in the local app database."
        action={
          <Button
            size="small"
            variant="contained"
            disableElevation
            startIcon={<Save size={14} />}
            onClick={saveProfile}
            disabled={isLoading || profileSaving || Boolean(profileError)}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            {profileSaving ? "Saving..." : "Save"}
          </Button>
        }
      >
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar
              src={isValidAvatarUrl(avatarUrl) ? avatarUrl.trim() || undefined : undefined}
              alt={displayName || email}
              sx={{
                width: 44,
                height: 44,
                bgcolor: "action.selected",
                color: "text.primary",
                fontSize: 15,
                fontWeight: 700,
              }}
            >
              {initialsFor(displayName, email)}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: "text.primary" }}>
                {displayName.trim() || email}
              </Typography>
              <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                {email}
              </Typography>
            </Box>
          </Stack>

          <TextField
            label="Display name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            fullWidth
            size="small"
            slotProps={{ htmlInput: { maxLength: 120 } }}
            sx={appTextFieldSx}
          />
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={!isValidEmail(email)}
            helperText={!isValidEmail(email) ? "Enter a valid email address." : " "}
            fullWidth
            required
            size="small"
            slotProps={{ htmlInput: { maxLength: 254 } }}
            sx={appTextFieldSx}
          />
          <TextField
            label="Profile picture URL"
            value={avatarUrl}
            onChange={(event) => setAvatarUrl(event.target.value)}
            error={!isValidAvatarUrl(avatarUrl)}
            helperText={!isValidAvatarUrl(avatarUrl) ? "Use an http or https URL." : " "}
            fullWidth
            size="small"
            slotProps={{ htmlInput: { maxLength: 2048 } }}
            sx={appTextFieldSx}
          />
        </Stack>
      </SettingCard>

      <SectionHeader
        title="Security"
        description="Change your password with current-password verification."
      />

      <SettingCard
        title="Password"
        description="Changing password keeps this session active and expires other sessions."
        action={
          <Button
            size="small"
            variant="outlined"
            startIcon={<Lock size={14} />}
            onClick={savePassword}
            disabled={
              isLoading ||
              passwordSaving ||
              Boolean(passwordError) ||
              !currentPassword ||
              !newPassword ||
              !confirmPassword
            }
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            {passwordSaving ? "Updating..." : "Update"}
          </Button>
        }
      >
        <Stack spacing={1.5}>
          <TextField
            label="Current password"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            fullWidth
            size="small"
            autoComplete="current-password"
            sx={appTextFieldSx}
          />
          <TextField
            label="New password"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            error={Boolean(newPassword) && (newPassword.length < 8 || newPassword.length > 128)}
            helperText={
              Boolean(newPassword) && (newPassword.length < 8 || newPassword.length > 128)
                ? "Use 8 to 128 characters."
                : " "
            }
            fullWidth
            size="small"
            autoComplete="new-password"
            slotProps={{ htmlInput: { maxLength: 128 } }}
            sx={appTextFieldSx}
          />
          <TextField
            label="Confirm new password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            error={Boolean(confirmPassword) && newPassword !== confirmPassword}
            helperText={Boolean(confirmPassword) && newPassword !== confirmPassword ? "Passwords do not match." : " "}
            fullWidth
            size="small"
            autoComplete="new-password"
            sx={appTextFieldSx}
          />
        </Stack>
      </SettingCard>
    </Stack>
  );
}
