import React, { useCallback, useState } from "react";
import { Box } from "@/components/ui/Box";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { ModalRoot } from "@/components/ui/modal-root";
import { Stack } from "@/components/ui/Stack";
import { Typography } from "@/components/ui/Typography";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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
    <Box className="relative grid w-full grid-cols-2 overflow-hidden rounded-full border border-border/60 bg-muted/40 p-1 sm:w-[260px]">
      <Box
        aria-hidden
        className={cn(
          "absolute top-1 bottom-1 w-[calc(50%_-_4px)] rounded-full bg-primary shadow-sm transition-all duration-[var(--dur-base)] ease-[var(--ease-premium)]",
          tab === "login" ? "left-1" : "left-1/2",
        )}
      />
      {tabs.map((item) => (
        <Button
          key={item.key}
          type="button"
          variant="ghost"
          onClick={() => onChange(item.key)}
          className={cn(
            "relative z-10 h-9 rounded-full bg-transparent text-[13px] font-bold hover:bg-transparent",
            tab === item.key ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {item.label}
        </Button>
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
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const actions = useAuthStore((state) => state.actions);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const passwordMismatch =
    tab === "signup" && confirmPassword !== "" && password !== confirmPassword;

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
    <Box as="form" onSubmit={submit} className="w-full">
      <Stack spacing={1.55}>
        {tab === "signup" && signupStep === 1 && (
          <>
            <StepStatus current={1} />
            <Field label="Name" htmlFor="signup-name">
              <Input
                className="h-10 rounded-lg"
                id="signup-name"
                placeholder="Tessa Rivera"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </Field>
            <Field label="Email" htmlFor="signup-email">
              <Input
                className="h-10 rounded-lg"
                id="signup-email"
                type="email"
                placeholder="you@polyui.local"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
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
              />
            </Field>
            <Field label="Confirm password" htmlFor="confirm-password">
              <Input
                className="h-10 rounded-lg pr-10"
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </Field>
            {passwordMismatch && (
              <Typography className="text-[13px] font-semibold text-destructive">
                Passwords do not match
              </Typography>
            )}
            {error && (
              <Typography className="text-[13px] font-semibold text-destructive">
                {error}
              </Typography>
            )}
            <Stack direction="row" spacing={1}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onSignupStepChange(1)}
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
                className="h-10 rounded-lg"
                id="login-email"
                type="email"
                placeholder="you@polyui.local"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
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
              />
            </Field>
            {error && (
              <Typography className="text-[13px] font-semibold text-destructive">
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
        align="center"
        color="muted"
        className="mt-4 text-[13px]"
      >
        {tab === "login" ? "New here?" : "Already have account?"}{" "}
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 align-baseline text-[13px] font-bold"
          onClick={() => onTabChange(tab === "login" ? "signup" : "login")}
        >
          {tab === "login" ? "Sign up" : "Sign in"}
        </Button>
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
      className="justify-center"
    >
      <StepDot active={current === 1}>1</StepDot>
      <Box className="h-px w-10 bg-border" />
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
      className={cn(
        "grid size-6 place-items-center rounded-full border text-xs font-bold",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border/60 text-muted-foreground",
      )}
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
      fullWidth={fullWidth}
      className="h-10 font-bold"
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
}: {
  id: string;
  value: string;
  showPassword: boolean;
  onChange: (value: string) => void;
  onToggleShowPassword: () => void;
}) {
  return (
    <Box className="relative">
      <Input
        className="h-10 rounded-lg pr-10"
        id={id}
        type={showPassword ? "text" : "password"}
        placeholder="Enter password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      />
      <IconButton
        type="button"
        size="small"
        onClick={onToggleShowPassword}
        aria-label={showPassword ? "Hide password" : "Show password"}
        className="absolute top-1/2 right-1 -translate-y-1/2"
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
        className="text-xs font-semibold text-muted-foreground"
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
      className="w-[min(420px,calc(100vw_-_32px))] rounded-3xl border border-border/60 bg-card/95 p-6 text-card-foreground shadow-2xl backdrop-blur-xl"
    >
      <Stack spacing={2.5} alignItems="center">
        <AuthTabs tab={tab} onChange={onTabChange} />
        <Typography
          id="auth-dialog-title"
          as="h2"
          variant="h4"
          align="center"
          className="pt-1"
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
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 text-[13px] font-semibold"
          onClick={skipAuth}
        >
          Continue as guest
        </Button>
      </Stack>
    </Box>
  );
}

export const AuthModal: React.FC = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const isGuest = useAuthStore((state) => state.isGuest);
  const [tab, setTab] = useState<AuthTab>("login");
  const [signupStep, setSignupStep] = useState<SignupStep>(1);
  const isOpen = !isAuthenticated && !isLoading && !isGuest;

  const handleTabChange = useCallback((nextTab: AuthTab) => {
    setTab(nextTab);
    setSignupStep(1);
  }, []);

  if (!isOpen) return null;

  return (
    <ModalRoot
      open={isOpen}
      aria-labelledby="auth-dialog-title"
      aria-modal="true"
    >
      <Box
        role="dialog"
        className="mt-[var(--titlebar-height)]"
      >
        <AuthPage
          tab={tab}
          signupStep={signupStep}
          onTabChange={handleTabChange}
          onSignupStepChange={setSignupStep}
        />
      </Box>
    </ModalRoot>
  );
};
