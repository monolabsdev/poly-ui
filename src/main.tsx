import React, { Suspense, lazy, useMemo, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { useMediaQuery } from "@mui/material";
import { darkTheme, lightTheme } from "./theme";
import { useThemeStore } from "./store/themeStore";
import { useSettingsStore } from "./store/settingsStore";
import { NotificationProvider } from "./components/ui/Toast/NotificationProvider";
import StartupLoadingScreen from "./components/StartupLoadingScreen";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { WindowTitleBar } from "./components/Layout/WindowTitleBar";
import { loadAppModule, prepareAppStartup } from "./startup";
import { IS_LINUX, USE_CUSTOM_WINDOW_CONTROLS } from "./lib/platform";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "@fontsource-variable/geist";
import "./App.css";

if (IS_LINUX) {
  document.documentElement.dataset.chrome = "native";
} else if (USE_CUSTOM_WINDOW_CONTROLS) {
  document.documentElement.dataset.chrome = "borderless";
}

const TITLE_BAR_HEIGHT = IS_LINUX ? 0 : 36;
document.documentElement.style.setProperty("--titlebar-height", `${TITLE_BAR_HEIGHT}px`);

const App = lazy(loadAppModule);

function onGlobalError(event: ErrorEvent) {
  console.error("[Global]", event.error ?? event.message);
}

function onGlobalRejection(event: PromiseRejectionEvent) {
  console.error("[Global] Unhandled rejection:", event.reason);
}

function getTheme(mode: string, prefersDark: boolean) {
  if (mode === "system") {
    return prefersDark ? darkTheme : lightTheme;
  }
  return mode === "dark" ? darkTheme : lightTheme;
}

function Root() {
  const mode = useThemeStore((state) => state.mode);
  const performance = useSettingsStore((state) => state.performance);
  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
  const [isAppReady, setIsAppReady] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [showStartupScreen, setShowStartupScreen] = useState(true);
  const [isStartupScreenVisible, setIsStartupScreenVisible] = useState(true);

  const theme = useMemo(() => getTheme(mode, prefersDarkMode), [mode, prefersDarkMode]);

  useEffect(() => {
    let cancelled = false;

    prepareAppStartup()
      .then(() => {
        if (!cancelled) setIsAppReady(true);
      })
      .catch((error) => {
        console.error("[startup] App startup failed:", error);
        if (!cancelled) setStartupError(formatStartupError(error));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isAppReady || startupError) {
      setIsStartupScreenVisible(false);
    }
  }, [isAppReady, startupError]);

  useEffect(() => {
    if (!isAppReady && !startupError) return;
    const show = () => {
      getCurrentWindow().show().catch((e) => console.error("window.show failed:", e));
    };
    const t1 = setTimeout(show, 50);
    const t2 = setTimeout(show, 500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [isAppReady, startupError]);

  useEffect(() => {
    window.addEventListener("error", onGlobalError);
    window.addEventListener("unhandledrejection", onGlobalRejection);
    return () => {
      window.removeEventListener("error", onGlobalError);
      window.removeEventListener("unhandledrejection", onGlobalRejection);
    };
  }, []);

  // Toggle dark class for Tailwind
  useEffect(() => {
    const isDark = mode === 'dark' || (mode === 'system' && prefersDarkMode);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [mode, prefersDarkMode]);

  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", performance.reduceMotion);
    document.documentElement.classList.toggle("reduce-transparency", performance.reduceTransparency);
    document.documentElement.dataset.performanceProfile = performance.profile;
  }, [performance.profile, performance.reduceMotion, performance.reduceTransparency]);
  useEffect(() => {
    if (!USE_CUSTOM_WINDOW_CONTROLS || !isAppReady) return;
    const w = getCurrentWindow();
    const sync = () => {
      void w.isMaximized().then((m) => {
        document.documentElement.classList.toggle("maximized", m);
      });
    };
    sync();
    const unlisten: (() => void)[] = [];
    void w.onResized(sync).then((fn) => unlisten.push(fn));
    return () => { unlisten.forEach((fn) => fn()); };
  }, [isAppReady]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <NotificationProvider>
        <ErrorBoundary>
          <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", paddingTop: "var(--titlebar-height)" }}>
            <WindowTitleBar />
            {startupError ? (
              <StartupErrorScreen message={startupError} />
            ) : isAppReady ? (
              <div
                className="animate-fade-in"
                style={{ flex: 1, minHeight: 0, overflow: "hidden" }}
              >
                <Suspense fallback={null}>
                  <App />
                </Suspense>
              </div>
            ) : null}
          </div>
          {showStartupScreen && (
            <StartupLoadingScreen
              visible={isStartupScreenVisible}
              onExited={() => setShowStartupScreen(false)}
            />
          )}
        </ErrorBoundary>
      </NotificationProvider>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  DEV ? (
    <React.StrictMode>
      <Root />
    </React.StrictMode>
  ) : (
    <Root />
  ),
);

function formatStartupError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function StartupErrorScreen({ message }: { message: string }) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 560 }}>
        <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>Poly UI could not start</h1>
        <p style={{ color: "rgba(255,255,255,0.68)", margin: 0 }}>{message}</p>
      </div>
    </div>
  );
}
