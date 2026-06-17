import React, { useCallback, useState } from "react";
import {
  Box,
  Button as MuiButton,
  IconButton,
  Modal as MuiModal,
  Stack,
  Typography,
} from "@mui/material";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type AuthTab = "login" | "signup";
type SignupStep = 1 | 2;

function AuthTabs({
  tab,
  onChange,
}: {
  tab: AuthTab;
  onChange: (tab: AuthTab) => void;
}) {
  const tabs: Array<{ key: AuthTab; label: string }> = [
    { key: "login", label: "Sign in" },
    { key: "signup", label: "Sign up" },
  ];

  return (
    <Box
      sx={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        p: 0.5,
        borderRadius: 999,
        bgcolor: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.08)",
        width: { xs: "100%", sm: 260 },
        overflow: "hidden",
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          top: 4,
          bottom: 4,
          left: tab === "login" ? 4 : "50%",
          width: "calc(50% - 4px)",
          borderRadius: 999,
          bgcolor: "#f5f5f5",
          boxShadow: "0 8px 24px rgba(0,0,0,0.24)",
        }}
      />
      {tabs.map((item) => (
        <MuiButton
          key={item.key}
          disableRipple
          onClick={() => onChange(item.key)}
          sx={{
            position: "relative",
            zIndex: 1,
            minHeight: 36,
            borderRadius: 999,
            color: tab === item.key ? "#050505" : "rgba(255,255,255,0.62)",
            fontWeight: 700,
            fontSize: 13,
            "&:hover": {
              bgcolor: "transparent",
              color: tab === item.key ? "#050505" : "#fff",
            },
          }}
        >
          {item.label}
        </MuiButton>
      ))}
    </Box>
  );
}

function AuthForm({
  tab,
  signupStep,
  onTabChange,
  onSignupStepChange,
}: {
  tab: AuthTab;
  signupStep: SignupStep;
  onTabChange: (tab: AuthTab) => void;
  onSignupStepChange: (step: SignupStep) => void;
}) {
  const { isLoading, error, actions } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const passwordMismatch =
    tab === "signup" && confirmPassword !== "" && password !== confirmPassword;

  const inputSx = {
    height: 40,
    borderRadius: "10px",
    bgcolor: "rgba(255,255,255,0.035)",
    borderColor: "rgba(255,255,255,0.09)",
    color: "#f4f4f5",
    "&.Mui-focused": {
      borderColor: "rgba(255,255,255,0.52)",
      boxShadow: "0 0 0 3px rgba(255,255,255,0.09)",
      bgcolor: "rgba(255,255,255,0.055)",
    },
    "& .MuiInputBase-input::placeholder": {
      color: "rgba(255,255,255,0.32)",
      opacity: 1,
    },
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (tab === "signup" && signupStep === 1) {
      onSignupStepChange(2);
      return;
    }

    if (passwordMismatch) return;

    try {
      if (tab === "login") await actions.login(email, password);
      else await actions.signup(email, password, fullName || undefined);
    } catch {
      // Store owns visible auth error.
    }
  };

  return (
    <Box component="form" onSubmit={submit}>
      <Stack spacing={1.55} sx={{ minHeight: 244 }}>
        {tab === "signup" && signupStep === 1 && (
          <>
            <StepStatus current={1} />
            <Field label="Name" htmlFor="signup-name">
              <Input
                id="signup-name"
                placeholder="Tessa Rivera"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                sx={inputSx}
              />
            </Field>
            <Field label="Email" htmlFor="signup-email">
              <Input
                id="signup-email"
                type="email"
                placeholder="you@polyui.local"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                sx={inputSx}
                required
              />
            </Field>
            <SubmitButton disabled={isLoading} fullWidth>
              Continue
            </SubmitButton>
          </>
        )}

        {tab === "signup" && signupStep === 2 && (
          <>
            <StepStatus current={2} />
            <Field label="Password" htmlFor="signup-password">
              <PasswordInput
                id="signup-password"
                value={password}
                showPassword={showPassword}
                onChange={setPassword}
                onToggleShowPassword={() => setShowPassword((value) => !value)}
                sx={inputSx}
              />
            </Field>
            <Field label="Confirm password" htmlFor="confirm-password">
              <Input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                sx={inputSx}
                required
              />
            </Field>
            {passwordMismatch && (
              <Typography
                sx={{ color: "#ff8a8a", fontSize: 13, fontWeight: 650 }}
              >
                Passwords do not match
              </Typography>
            )}
            {error && (
              <Typography
                sx={{ color: "#ff8a8a", fontSize: 13, fontWeight: 650 }}
              >
                {error}
              </Typography>
            )}
            <Stack direction="row" spacing={1}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onSignupStepChange(1)}
                sx={{
                  width: 44,
                  height: 42,
                  borderRadius: 999,
                  color: "rgba(255,255,255,0.72)",
                  flexShrink: 0,
                }}
                aria-label="Back to signup details"
              >
                <ArrowLeft size={17} />
              </Button>
              <SubmitButton disabled={isLoading || passwordMismatch}>
                {isLoading ? "Working..." : "Create account"}
              </SubmitButton>
            </Stack>
          </>
        )}

        {tab === "login" && (
          <>
            <Field label="Email" htmlFor="login-email">
              <Input
                id="login-email"
                type="email"
                placeholder="you@polyui.local"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                sx={inputSx}
                required
              />
            </Field>
            <Field label="Password" htmlFor="login-password">
              <PasswordInput
                id="login-password"
                value={password}
                showPassword={showPassword}
                onChange={setPassword}
                onToggleShowPassword={() => setShowPassword((value) => !value)}
                sx={inputSx}
              />
            </Field>
            {error && (
              <Typography
                sx={{ color: "#ff8a8a", fontSize: 13, fontWeight: 650 }}
              >
                {error}
              </Typography>
            )}
            <SubmitButton disabled={isLoading} fullWidth>
              {isLoading ? "Working..." : "Sign in"}
            </SubmitButton>
          </>
        )}
      </Stack>

      <Typography
        sx={{
          color: "rgba(255,255,255,0.45)",
          fontSize: 13,
          textAlign: "center",
          mt: 2,
        }}
      >
        {tab === "login" ? "New here?" : "Already have account?"}{" "}
        <MuiButton
          disableRipple
          onClick={() => onTabChange(tab === "login" ? "signup" : "login")}
          sx={{
            p: 0,
            minWidth: 0,
            color: "#fff",
            fontWeight: 750,
            verticalAlign: "baseline",
            "&:hover": { bgcolor: "transparent", textDecoration: "underline" },
          }}
        >
          {tab === "login" ? "Sign up" : "Sign in"}
        </MuiButton>
      </Typography>
    </Box>
  );
}

function StepStatus({ current }: { current: SignupStep }) {
  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      sx={{ color: "rgba(255,255,255,0.52)", fontSize: 12, fontWeight: 700 }}
    >
      <StepDot active={current === 1}>1</StepDot>
      <Box sx={{ height: 1, flex: 1, bgcolor: "rgba(255,255,255,0.12)" }} />
      <StepDot active={current === 2}>2</StepDot>
    </Stack>
  );
}

function StepDot({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        width: 24,
        height: 24,
        borderRadius: 999,
        display: "grid",
        placeItems: "center",
        bgcolor: active ? "#f5f5f5" : "rgba(255,255,255,0.08)",
        color: active ? "#050505" : "rgba(255,255,255,0.56)",
      }}
    >
      {children}
    </Box>
  );
}

function SubmitButton({
  disabled,
  fullWidth = false,
  children,
}: {
  disabled?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="submit"
      disabled={disabled}
      sx={{
        flex: fullWidth ? "none" : 1,
        width: fullWidth ? "100%" : "auto",
        height: 42,
        borderRadius: 999,
        bgcolor: "#f4f4f5",
        color: "#050505",
        fontWeight: 800,
        "&:hover": { bgcolor: "#ffffff", opacity: 1 },
        "&.Mui-disabled": {
          bgcolor: "rgba(255,255,255,0.2)",
          color: "rgba(255,255,255,0.45)",
        },
      }}
    >
      {children}
    </Button>
  );
}

function PasswordInput({
  id,
  value,
  showPassword,
  onChange,
  onToggleShowPassword,
  sx,
}: {
  id: string;
  value: string;
  showPassword: boolean;
  onChange: (value: string) => void;
  onToggleShowPassword: () => void;
  sx: object;
}) {
  return (
    <Box sx={{ position: "relative" }}>
      <Input
        id={id}
        type={showPassword ? "text" : "password"}
        placeholder="Enter password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        sx={{ ...sx, pr: 5 }}
        required
      />
      <IconButton
        type="button"
        size="small"
        onClick={onToggleShowPassword}
        aria-label={showPassword ? "Hide password" : "Show password"}
        sx={{
          position: "absolute",
          right: 7,
          top: "50%",
          transform: "translateY(-50%)",
          color: "rgba(255,255,255,0.56)",
        }}
      >
        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
      </IconButton>
    </Box>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <Stack spacing={0.85}>
      <Label
        htmlFor={htmlFor}
        sx={{ color: "rgba(255,255,255,0.78)", fontSize: 13, fontWeight: 750 }}
      >
        {label}
      </Label>
      {children}
    </Stack>
  );
}

function AuthPage({
  tab,
  signupStep,
  onTabChange,
  onSignupStepChange,
}: {
  tab: AuthTab;
  signupStep: SignupStep;
  onTabChange: (tab: AuthTab) => void;
  onSignupStepChange: (step: SignupStep) => void;
}) {
  const skipAuth = useAuthStore((state) => state.actions.skipAuth);

  return (
    <Box
      sx={{
        minHeight: "100%",
        boxSizing: "border-box",
        bgcolor: "#070707",
        color: "#f5f5f5",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflowX: "hidden",
        px: { xs: 3, sm: 6 },
        py: { xs: 4, md: 6 },
      }}
    >
      <Stack spacing={2.5} sx={{ width: "min(100%, 420px)" }}>
        <AuthTabs tab={tab} onChange={onTabChange} />
        <Typography
          id="auth-dialog-title"
          sx={{ m: 0, fontSize: 28, fontWeight: 820, letterSpacing: 0 }}
        >
          {tab === "login"
            ? "Welcome back"
            : signupStep === 1
              ? "Create your account"
              : "Secure your account"}
        </Typography>
        <AuthForm
          tab={tab}
          signupStep={signupStep}
          onTabChange={onTabChange}
          onSignupStepChange={onSignupStepChange}
        />
        <MuiButton
          disableRipple
          onClick={skipAuth}
          sx={{
            color: "rgba(255,255,255,0.62)",
            fontWeight: 700,
            alignSelf: "center",
            "&:hover": { bgcolor: "transparent", color: "#fff" },
          }}
        >
          Continue as guest
        </MuiButton>
      </Stack>
    </Box>
  );
}

export const AuthModal: React.FC = () => {
  const { isAuthenticated, isLoading, isGuest } = useAuthStore();
  const [tab, setTab] = useState<AuthTab>("login");
  const [signupStep, setSignupStep] = useState<SignupStep>(1);
  const isOpen = !isAuthenticated && !isLoading && !isGuest;

  const handleTabChange = useCallback((nextTab: AuthTab) => {
    setTab(nextTab);
    setSignupStep(1);
  }, []);

  if (!isOpen) return null;

  return (
    <MuiModal
      open={isOpen}
      aria-labelledby="auth-dialog-title"
      aria-modal="true"
      slotProps={{
        backdrop: {
          sx: { top: "var(--titlebar-height)" },
        },
      }}
    >
      <Box
        role="dialog"
        sx={{
          position: "fixed",
          top: "var(--titlebar-height)",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1000,
          overflowY: "hidden",
          overflowX: "hidden",
        }}
      >
        <AuthPage
          tab={tab}
          signupStep={signupStep}
          onTabChange={handleTabChange}
          onSignupStepChange={setSignupStep}
        />
      </Box>
    </MuiModal>
  );
};
