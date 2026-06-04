import React, { Suspense, lazy, useMemo, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { useMediaQuery } from "@mui/material";
import { motion } from "motion/react";
import { darkTheme, lightTheme } from "./theme";
import { useThemeStore } from "./store/themeStore";
import { useSettingsStore } from "./store/settingsStore";
import { NotificationProvider } from "./components/ui/Toast/NotificationProvider";
import StartupLoadingScreen from "./components/StartupLoadingScreen";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { WindowTitleBar } from "./components/Layout/WindowTitleBar";
import { loadAppModule, prepareAppStartup } from "./startup";
import { USE_CUSTOM_WINDOW_CONTROLS, IS_LINUX } from "./lib/platform";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "@fontsource-variable/geist";
import "./App.css";

if (IS_LINUX) {
  document.documentElement.dataset.chrome = "native";
} else if (USE_CUSTOM_WINDOW_CONTROLS) {
  document.documentElement.dataset.chrome = "borderless";
}

const App = lazy(loadAppModule);

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
  const [showStartupScreen, setShowStartupScreen] = useState(true);
  const [isStartupScreenVisible, setIsStartupScreenVisible] = useState(true);

  const theme = useMemo(() => getTheme(mode, prefersDarkMode), [mode, prefersDarkMode]);

  useEffect(() => {
    let cancelled = false;

    prepareAppStartup().then(() => {
      if (!cancelled) setIsAppReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isAppReady) {
      setIsStartupScreenVisible(false);
    }
  }, [isAppReady]);

  useEffect(() => {
    if (!isAppReady) return;
    const show = () => {
      getCurrentWindow().show().catch((e) => console.error("window.show failed:", e));
    };
    const t1 = setTimeout(show, 50);
    const t2 = setTimeout(show, 500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [isAppReady]);

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      console.error("[Global]", event.error ?? event.message);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      console.error("[Global] Unhandled rejection:", event.reason);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
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
          <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <WindowTitleBar />
            {isAppReady && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.24, ease: "easeOut" }}
                style={{ flex: 1, minHeight: 0, overflow: "hidden" }}
              >
                <Suspense fallback={null}>
                  <App />
                </Suspense>
              </motion.div>
            )}
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
