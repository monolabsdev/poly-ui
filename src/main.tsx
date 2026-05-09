import React, { Suspense, lazy, useMemo, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { useMediaQuery } from "@mui/material";
import { motion } from "motion/react";
import { darkTheme, lightTheme } from "./theme";
import { useThemeStore } from "./store/themeStore";
import { NotificationProvider } from "./components/ui/Toast/NotificationProvider";
import StartupLoadingScreen from "./components/StartupLoadingScreen";
import { loadAppModule, prepareAppStartup } from "./startup";
import "@fontsource-variable/geist";

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
  const [showStartupScreen, setShowStartupScreen] = useState(true);
  const [isStartupScreenVisible, setIsStartupScreenVisible] = useState(true);

  const theme = useMemo(() => getTheme(mode, prefersDarkMode), [mode, prefersDarkMode]);

  useEffect(() => {
    const isDark = mode === "dark" || (mode === "system" && prefersDarkMode);
    document.documentElement.classList.toggle("dark", isDark);
  }, [mode, prefersDarkMode]);

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

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <NotificationProvider>
        {isAppReady && (
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
      </NotificationProvider>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
