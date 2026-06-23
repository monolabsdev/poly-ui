import { useEffect, useRef, useState } from "react";
import { Avatar, Box, Button, ButtonBase, Stack, TextField, Typography } from "@mui/material";
import { Camera, Lock, Save } from "lucide-react";
import { EmptyState, SectionHeader, SettingCard } from "../SettingComponents";
import { appTextFieldSx } from "@/components/ui/appDialog";
import { useNotify } from "@/hooks/useNotify";
import { imageUploadConfig } from "@/lib/image-upload/config";
import { validateImageFiles } from "@/lib/image-upload/validation";
import { useAuthStore } from "@/store/authStore";
import { useShallow } from "zustand/react/shallow";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const IMAGE_ACCEPT = imageUploadConfig.allowedMimeTypes.join(",");
const PASSWORD_HELP = "Use 8 to 128 characters.";

const isValidEmail = (value: string) =>
  value.length > 3 &&
  value.length <= 254 &&
  value.includes("@") &&
  !value.startsWith("@") &&
  !value.endsWith("@") &&
  !/\s/.test(value);

const readDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Image could not be read."));
    reader.onerror = () => reject(new Error("Image could not be read."));
    reader.readAsDataURL(file);
  });

const initialsFor = (name: string, email: string) => (name.trim() || email.trim() || "U")[0].toUpperCase();

type AvatarPickerProps = {
  value: string;
  label: string;
  fallback: string;
  onChange: (dataUrl: string, fileName: string) => void;
};

function AvatarPicker({ value, label, fallback, onChange }: AvatarPickerProps) {
  const notify = useNotify();
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const validation = validateImageFiles([file], { maxFiles: 1, maxFileSize: MAX_AVATAR_BYTES });
    if (validation.errors[0]) return notify.error("Profile picture rejected", validation.errors[0].message);
    try {
      onChange(await readDataUrl(file), file.name);
    } catch (err) {
      notify.error("Profile picture failed", String(err));
    }
  };

  return (
    <>
      <input ref={inputRef} type="file" accept={IMAGE_ACCEPT} onChange={pick} style={{ display: "none" }} />
      <ButtonBase
        aria-label="Upload profile picture"
        onClick={() => inputRef.current?.click()}
        sx={{
          position: "relative",
          borderRadius: "9999px",
          cursor: "pointer",
          "&:hover .ProfileAvatarImage": { opacity: 0.6 },
          "&:hover .ProfileAvatarOverlay": { opacity: 1 },
          "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
        }}
      >
        <Avatar
          className="ProfileAvatarImage"
          src={value || undefined}
          alt={label}
          sx={{
            width: 64,
            height: 64,
            bgcolor: "action.selected",
            color: "text.primary",
            fontSize: 20,
            fontWeight: 800,
            transition: "opacity 120ms ease",
          }}
        >
          {fallback}
        </Avatar>
        <Box
          className="ProfileAvatarOverlay"
          sx={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            borderRadius: "9999px",
            bgcolor: "action.selected",
            color: "text.primary",
            opacity: 0,
            transition: "opacity 120ms ease",
            pointerEvents: "none",
          }}
        >
          <Camera size={20} />
        </Box>
      </ButtonBase>
    </>
  );
}

export function ProfileTab() {
  const notify = useNotify();
  const dirtyRef = useRef(false);
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
  const [avatar, setAvatar] = useState(user?.avatarUrl ?? "");
  const [avatarFileName, setAvatarFileName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();
  const profileDirty =
    displayName.trim() !== (user?.fullName ?? "") ||
    normalizedEmail !== (user?.email ?? "").toLowerCase() ||
    avatar !== (user?.avatarUrl ?? "");
  const passwordDirty = Boolean(currentPassword || newPassword || confirmPassword);
  const passwordInvalid =
    Boolean(newPassword) && (newPassword.length < 8 || newPassword.length > 128);
  const passwordMismatch = Boolean(confirmPassword) && newPassword !== confirmPassword;
  const emailInvalid = !isValidEmail(normalizedEmail);

  useEffect(() => {
    setDisplayName(user?.fullName ?? "");
    setEmail(user?.email ?? "");
    setAvatar(user?.avatarUrl ?? "");
    setAvatarFileName("");
  }, [user?.avatarUrl, user?.email, user?.fullName]);

  useEffect(() => {
    dirtyRef.current = profileDirty || passwordDirty;
  }, [passwordDirty, profileDirty]);

  useEffect(() => () => {
    if (dirtyRef.current) notify.warn("Unsaved profile changes");
  }, [notify]);

  if (!user || isGuest) return <EmptyState>Profile settings are available after sign in.</EmptyState>;

  const saveProfile = async () => {
    if (emailInvalid || !profileDirty) return;
    setProfileSaving(true);
    try {
      await actions.updateProfile({ email: normalizedEmail, fullName: displayName.trim() || undefined, avatarUrl: avatar || undefined });
      notify.success("Profile updated");
    } catch (err) {
      notify.error("Profile update failed", String(err));
    } finally {
      setProfileSaving(false);
    }
  };

  const savePassword = async () => {
    if (passwordInvalid || passwordMismatch || !currentPassword || !newPassword) return;
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
    <Stack spacing={3}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 750, color: "text.primary" }}>Profile</Typography>
        <Typography sx={{ mt: 0.5, fontSize: 13, color: "text.secondary", lineHeight: 1.5 }}>
          Manage local account details, profile picture, and password.
        </Typography>
      </Box>

      <Stack spacing={1.5}>
        <SectionHeader title="Identity" description="These details stay in the local app database." />
        <SettingCard title="Account details">
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "flex-start", sm: "center" }}>
              <AvatarPicker
                value={avatar}
                label={displayName || email}
                fallback={initialsFor(displayName, email)}
                onChange={(dataUrl, fileName) => {
                  setAvatar(dataUrl);
                  setAvatarFileName(fileName);
                }}
              />
              <Stack spacing={1.5} sx={{ flex: 1, width: "100%", minWidth: 0 }}>
                <TextField label="Display name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} fullWidth size="small" slotProps={{ htmlInput: { maxLength: 120 } }} sx={appTextFieldSx} />
                <TextField label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} error={emailInvalid} helperText={emailInvalid ? "Enter a valid email address." : " "} fullWidth required size="small" slotProps={{ htmlInput: { maxLength: 254 } }} sx={appTextFieldSx} />
              </Stack>
            </Stack>

            <Stack spacing={1} alignItems="flex-start">
              <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                {avatarFileName ? `Selected ${avatarFileName}` : "Click avatar to choose a local image."}
              </Typography>
              <Button size="small" variant="contained" disableElevation startIcon={<Save size={14} />} onClick={saveProfile} disabled={isLoading || profileSaving || emailInvalid || !profileDirty} sx={{ textTransform: "none", fontWeight: 700 }}>
                {profileDirty && <Box component="span" sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "warning.main", mr: 0.75 }} />}
                {profileSaving ? "Saving..." : "Save"}
              </Button>
            </Stack>
          </Stack>
        </SettingCard>
      </Stack>

      <Stack spacing={1.5}>
        <SectionHeader title="Security" description="Change your password with current-password verification." />
        <SettingCard title="Password" description="Changing password keeps this session active and expires other sessions.">
          <Stack spacing={1.5}>
            <TextField label="Current password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} fullWidth size="small" autoComplete="current-password" sx={appTextFieldSx} />
            <TextField label="New password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} error={passwordInvalid} helperText={passwordInvalid ? PASSWORD_HELP : " "} fullWidth size="small" autoComplete="new-password" slotProps={{ htmlInput: { maxLength: 128 } }} sx={appTextFieldSx} />
            <TextField label="Confirm new password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} error={passwordMismatch} helperText={passwordMismatch ? "Passwords do not match." : " "} fullWidth size="small" autoComplete="new-password" slotProps={{ htmlInput: { maxLength: 128 } }} sx={appTextFieldSx} />
            <Box>
              <Button size="small" variant="outlined" startIcon={<Lock size={14} />} onClick={savePassword} disabled={isLoading || passwordSaving || passwordInvalid || passwordMismatch || !currentPassword || !newPassword || !confirmPassword} sx={{ textTransform: "none", fontWeight: 700 }}>
                {passwordSaving ? "Updating..." : "Update password"}
              </Button>
            </Box>
          </Stack>
        </SettingCard>
      </Stack>
    </Stack>
  );
}
