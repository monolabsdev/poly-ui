import React, { Suspense, lazy, useMemo, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { useMediaQuery } from "@mui/material";
import { motion } from "motion/react";
import { darkTheme, lightTheme } from "./theme";
import { useThemeStore } from "./store/themeStore";
import StartupLoadingScreen from "./components/StartupLoadingScreen";
import { delay, loadAppModule, prepareAppStartup } from "./startup";
import "@fontsource-variable/geist";

const MIN_STARTUP_DELAY_MS = 1000;
const App = lazy(loadAppModule);

function getTheme(mode: string, prefersDark: boolean) {
  if (mode === "system") {
    return prefersDark ? darkTheme : lightTheme;
  }
  return mode === "dark" ? darkTheme : lightTheme;
}

function Root() {
  const { mode } = useThemeStore();
  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
  const [isAppReady, setIsAppReady] = useState(false);
  const [hasMinDelayPassed, setHasMinDelayPassed] = useState(false);
  const [showStartupScreen, setShowStartupScreen] = useState(true);
  const [isStartupScreenVisible, setIsStartupScreenVisible] = useState(true);
  const canRenderApp = isAppReady && hasMinDelayPassed;

  const theme = useMemo(() => getTheme(mode, prefersDarkMode), [mode, prefersDarkMode]);

  useEffect(() => {
    const isDark = mode === "dark" || (mode === "system" && prefersDarkMode);
    document.documentElement.classList.toggle("dark", isDark);
  }, [mode, prefersDarkMode]);

  useEffect(() => {
    let cancelled = false;
    let frame = 0;

    frame = requestAnimationFrame(() => {
      void delay(MIN_STARTUP_DELAY_MS).then(() => {
        if (!cancelled) setHasMinDelayPassed(true);
      });

      void prepareAppStartup().then(() => {
        if (!cancelled) setIsAppReady(true);
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (canRenderApp) {
      setIsStartupScreenVisible(false);
    }
  }, [canRenderApp]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {canRenderApp && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.24, ease: "easeOut" }}
          style={{ height: "100vh", overflow: "hidden" }}
        >
          <Suspense fallback={null}>
            <App />
          </Suspense>
        </motion.div>
      )}
      {showStartupScreen && (
        <StartupLoadingScreen
          visible={isStartupScreenVisible}
          onExited={() => setShowStartupScreen(false)}
        />
      )}
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
