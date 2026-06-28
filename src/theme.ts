import { createTheme, ThemeOptions } from "@mui/material/styles";

type AppThemeTokens = {
  radius: {
    commandPalette: string;
    control: string;
    dialog: string;
    menu: string;
    menuItem: string;
    pill: string;
  };
  shadow: {
    authActive: string;
    dialog: string;
  };
};

type AuthPalette = {
  background: string;
  control: string;
  controlHover: string;
  danger: string;
  disabledSurface: string;
  disabledText: string;
  divider: string;
  focusBorder: string;
  focusRing: string;
  ghostText: string;
  inputBackground: string;
  inputBackgroundFocus: string;
  inputBorder: string;
  inverseText: string;
  selectedSurface: string;
  tabBackground: string;
  tabBorder: string;
  text: string;
  textFaint: string;
  textMuted: string;
  textSecondary: string;
  textSubtle: string;
};

declare module "@mui/material/styles" {
  interface Theme {
    app: AppThemeTokens;
  }
  interface ThemeOptions {
    app?: AppThemeTokens;
  }
  interface TypeBackground {
    sidebar: string;
    chatPanel: string;
  }
  interface Palette {
    border: {
      light: string;
      main: string;
    };
    chat: {
      bubble: string;
      bubbleUser: string;
    };
    auth: AuthPalette;
  }
  interface PaletteColor {
    soft: string;
  }
  interface SimplePaletteColorOptions {
    soft?: string;
  }
  interface PaletteOptions {
    border?: {
      light?: string;
      main?: string;
    };
    chat?: {
      bubble?: string;
      bubbleUser?: string;
    };
    auth?: AuthPalette;
  }
}

const appRadius = {
  commandPalette: "20px",
  control: "8px",
  dialog: "12px",
  menu: "18px",
  menuItem: "10px",
  pill: "9999px",
} as const;

const authPalette: AuthPalette = {
  background: "#070707",
  control: "#f4f4f5",
  controlHover: "#ffffff",
  danger: "#ff8a8a",
  disabledSurface: "rgba(255,255,255,0.2)",
  disabledText: "rgba(255,255,255,0.45)",
  divider: "rgba(255,255,255,0.12)",
  focusBorder: "rgba(255,255,255,0.52)",
  focusRing: "0 0 0 3px rgba(255,255,255,0.09)",
  ghostText: "rgba(255,255,255,0.72)",
  inputBackground: "rgba(255,255,255,0.035)",
  inputBackgroundFocus: "rgba(255,255,255,0.055)",
  inputBorder: "rgba(255,255,255,0.09)",
  inverseText: "#050505",
  selectedSurface: "#f5f5f5",
  tabBackground: "rgba(255,255,255,0.06)",
  tabBorder: "rgba(255,255,255,0.08)",
  text: "#f5f5f5",
  textFaint: "rgba(255,255,255,0.32)",
  textMuted: "rgba(255,255,255,0.62)",
  textSecondary: "rgba(255,255,255,0.78)",
  textSubtle: "rgba(255,255,255,0.45)",
};

const baseThemeOptions: ThemeOptions = {
  cssVariables: true,
  typography: {
    fontFamily: '"Geist Variable", "Inter", "system-ui", "sans-serif"',
    fontSize: 14,
    h1: { fontSize: "2.5rem", fontWeight: 600 },
    h2: { fontSize: "2rem", fontWeight: 600 },
    h3: { fontSize: "1.5rem", fontWeight: 600 },
    h4: { fontSize: "1.25rem", fontWeight: 600 },
    h5: { fontSize: "1.125rem", fontWeight: 600 },
    h6: { fontSize: "1rem", fontWeight: 600 },
    body1: { fontSize: "1rem" },
    body2: { fontSize: "0.875rem" },
    caption: { fontSize: "0.75rem" },
    button: { textTransform: "none", fontWeight: 500 },
  },
  shape: {
    borderRadius: 12,
  },
  spacing: 8,
  zIndex: {
    modal: 9000,
  },
  components: {
    MuiButtonBase: {
      defaultProps: {
        disableRipple: true,
      },
      styleOverrides: {
        root: {
          borderRadius: appRadius.pill,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: theme.app.radius.pill,
          padding: "6px 16px",
          border: "none",
          "&.Mui-disabled": {
            color: theme.palette.text.disabled,
            backgroundColor: theme.palette.action.disabledBackground,
          },
        }),
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: appRadius.pill,
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          borderRadius: appRadius.pill,
          border: "none",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        container: {
          position: "relative",
          top: "var(--titlebar-height)",
          height: "calc(100% - var(--titlebar-height))",
          overflow: "hidden",
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: appRadius.menuItem,
          margin: "4px 8px",
          padding: "8px 12px",
          fontSize: "14px",
          gap: "12px",
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: appRadius.menu,
        },
      },
    },
  },
};

const darkSugarHighVariables = {
  "--sh-keyword": "#c084fc",
  "--sh-class": "#60a5fa",
  "--sh-identifier": "#ececec",
  "--sh-string": "#4ade80",
  "--sh-comment": "#a3a3a3",
  "--sh-sign": "#a3a3a3",
  "--sh-jsxliterals": "#fbbf24",
  "--sh-entity": "#60a5fa",
  "--sh-property": "#f87171",
};

const lightSugarHighVariables = {
  "--sh-keyword": "#9333ea",
  "--sh-class": "#0288d1",
  "--sh-identifier": "#1a1a1a",
  "--sh-string": "#15803d",
  "--sh-comment": "#737373",
  "--sh-sign": "#737373",
  "--sh-jsxliterals": "#b45309",
  "--sh-entity": "#0288d1",
  "--sh-property": "#dc2626",
};

export const darkTheme = createTheme({
  ...baseThemeOptions,
  app: {
    radius: appRadius,
    shadow: {
      authActive: "0 8px 24px rgba(0,0,0,0.24)",
      dialog: "0 24px 72px rgba(0,0,0,0.54)",
    },
  },
  components: {
    ...baseThemeOptions.components,
    MuiCssBaseline: {
      styleOverrides: {
        ":root": darkSugarHighVariables,
      },
    },
  },
  palette: {
    mode: "dark",
    primary: {
      main: "#ffffff",
      contrastText: "#000000",
    },
    secondary: {
      main: "#2f2f2f", // From reference design (message bubbles, active states)
      contrastText: "#ffffff",
    },
    background: {
      default: "#171717", // Subtle dark grey from reference
      paper: "#1a1a1a", // Slightly lighter for inputs/cards
      sidebar: "#121212", // Darker background for sidebar
      chatPanel: "#181818", // Slightly lighter than sidebar for chat area
    },
    text: {
      primary: "#ececec", // Soft white for better readability
      secondary: "#a3a3a3", // Muted text, fully opaque (neutral-400)
    },
    divider: "rgba(255, 255, 255, 0.05)",
    action: {
      hover: "rgba(255, 255, 255, 0.05)",
      selected: "rgba(255, 255, 255, 0.1)",
    },
    border: {
      main: "rgba(255, 255, 255, 0.1)",
      light: "rgba(255, 255, 255, 0.05)",
    },
    chat: {
      bubble: "#262626",
      bubbleUser: "#212121",
    },
    auth: authPalette,
    success: {
      main: "#4ade80",
      soft: "rgba(74, 222, 128, 0.1)",
    },
    error: {
      main: "#f87171",
      soft: "rgba(248, 113, 113, 0.1)",
    },
    info: {
      main: "#60a5fa",
      soft: "rgba(96, 165, 250, 0.1)",
    },
    warning: {
      main: "#fbbf24",
      soft: "rgba(251, 191, 36, 0.1)",
    },
  },
});

export const lightTheme = createTheme({
  ...baseThemeOptions,
  app: {
    radius: appRadius,
    shadow: {
      authActive: "0 8px 24px rgba(0,0,0,0.24)",
      dialog: "0 24px 72px rgba(15,23,42,0.14)",
    },
  },
  components: {
    ...baseThemeOptions.components,
    MuiCssBaseline: {
      styleOverrides: {
        ":root": lightSugarHighVariables,
      },
    },
  },
  palette: {
    mode: "light",
    primary: {
      main: "#000000",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#f5f5f5",
      contrastText: "#000000",
    },
    background: {
      default: "#ffffff",
      paper: "#f9f9f9",
      sidebar: "#f3f3f3",
      chatPanel: "#f5f5f5",
    },
    text: {
      primary: "#1a1a1a",
      secondary: "#737373", // Muted text, fully opaque (neutral-500)
    },
    divider: "rgba(0, 0, 0, 0.05)",
    action: {
      hover: "rgba(0, 0, 0, 0.05)",
      selected: "rgba(0, 0, 0, 0.1)",
    },
    border: {
      main: "rgba(0, 0, 0, 0.1)",
      light: "rgba(0, 0, 0, 0.05)",
    },
    chat: {
      bubble: "#f3f3f3",
      bubbleUser: "#f5f5f5",
    },
    auth: authPalette,
    success: {
      main: "#22c55e",
      soft: "rgba(34, 197, 94, 0.1)",
    },
    error: {
      main: "#ef4444",
      soft: "rgba(239, 68, 68, 0.1)",
    },
    info: {
      main: "#0288d1",
      soft: "rgba(2, 136, 209, 0.1)",
    },
    warning: {
      main: "#ed6c02",
      soft: "rgba(237, 108, 2, 0.1)",
    },
  },
});
