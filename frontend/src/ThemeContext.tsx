import React, { createContext, useContext, useState, useEffect } from "react";
import type { Theme, ThemeTokens } from "./theme";
import { dark, light } from "./theme";

interface ThemeContextValue {
  theme: Theme;
  tokens: ThemeTokens;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  tokens: dark,
  toggle: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem("mg-theme") as Theme) ?? "dark";
  });

  useEffect(() => {
    localStorage.setItem("mg-theme", theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  const tokens = theme === "dark" ? dark : light;

  return (
    <ThemeContext.Provider value={{ theme, tokens, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
