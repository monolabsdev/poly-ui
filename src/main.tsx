import React, { useMemo, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { alpha, ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import useMediaQuery from "@mui/material/useMediaQuery";
import { darkTheme, lightTheme } from "./theme";
import { useThemeStore } from "./store/themeStore";
import { useSettingsStore } from "./store/settingsStore";
import { NotificationProvider } from "./components/ui/Toast/NotificationProvider";
import StartupLoadingScreen from "./components/StartupLoadingScreen";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { WindowTitleBar } from "./components/Layout/WindowTitleBar";
import { prepareAppStartup } from "./startup";
import {
  startupError as reportStartupError,
  startupPhase,
} from "./lib/utils/startupDiagnostics";
import { USE_CUSTOM_WINDOW_CONTROLS } from "./lib/utils/platform";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import "@fontsource-variable/geist";
import "./App.css";
import App from "./App";

const TITLE_BAR_HEIGHT = 36;
document.documentElement.style.setProperty("--titlebar-height", `${TITLE_BAR_HEIGHT}px`);


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
    document.documentElement.style.setProperty("--background", theme.palette.background.sidebar);
    document.documentElement.style.setProperty("--border", theme.palette.divider);
    document.documentElement.style.setProperty("--app-scrollbar-thumb", alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.14 : 0.24));
    document.documentElement.style.setProperty("--app-scrollbar-thumb-hover", alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.24 : 0.34));
    document.documentElement.style.setProperty("--app-drop-bg", alpha(theme.palette.info.main, 0.08));
    document.documentElement.style.setProperty("--app-drop-border", alpha(theme.palette.info.main, 0.9));
    document.documentElement.style.setProperty("--app-drop-ring", alpha(theme.palette.info.main, 0.1));
    document.documentElement.style.setProperty("--app-drop-label-bg", alpha(theme.palette.info.main, 0.12));
    document.documentElement.style.setProperty("--app-drop-label-border", alpha(theme.palette.info.main, 0.24));
  }, [theme]);

  useEffect(() => {
    let cancelled = false;

    startupPhase("prepareAppStartup begin");
    prepareAppStartup()
      .then(() => {
        startupPhase("prepareAppStartup complete");
        invoke("startup_frontend_loaded").catch((e) => console.error("[startup] frontend log failed:", e));
        if (!cancelled) setIsAppReady(true);
      })
      .catch((error) => {
        reportStartupError("App startup failed", error);
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
      startupPhase("window show requested");
      getCurrentWindow().show().catch((e) => reportStartupError("window.show failed", e));
    };
    const t1 = setTimeout(show, 50);
    const t2 = setTimeout(show, 500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [isAppReady, startupError]);

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
  }, [performance.reduceMotion, performance.reduceTransparency]);
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

  useEffect(() => {
    if (!DEV) return;
    const id = setInterval(() => {
      window.performance.clearMeasures();
      window.performance.clearMarks();
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <NotificationProvider>
        <ErrorBoundary>
          <div className="app-root-shell">
            <WindowTitleBar />
            {startupError ? (
              <StartupErrorScreen message={startupError} />
            ) : isAppReady ? (
              <div
                className="app-content animate-fade-in"
              >
                  <App />
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

startupPhase("react root render begin");
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  DEV ? (
    <React.StrictMode>
      <Root />
    </React.StrictMode>
  ) : (
    <Root />
  ),
);
startupPhase("react root render requested");

function formatStartupError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function StartupErrorScreen({ message }: { message: string }) {
  const [logPath, setLogPath] = useState<string | null>(null);

  useEffect(() => {
    invoke<string | null>("startup_log_path")
      .then((path) => setLogPath(path))
      .catch(() => setLogPath(null));
  }, []);

  return (
    <div className="startup-error-screen">
      <div className="startup-error-panel">
        <h1 className="startup-error-title">Poly UI could not start</h1>
        <p className="startup-error-message">{message}</p>
        {logPath ? (
          <p className="startup-error-log">
            Log: {logPath}
          </p>
        ) : null}
        <button
          onClick={() => window.location.reload()}
          className="startup-error-button"
        >
          Restart
        </button>
      </div>
    </div>
  );
}
