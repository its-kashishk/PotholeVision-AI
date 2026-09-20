import React, { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("pv_theme");
    if (saved) return saved === "dark";
    return false;
  });

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      isDark ? "dark" : "light",
    );
    localStorage.setItem("pv_theme", isDark ? "dark" : "light");
  }, [isDark]);

  return (
    <ThemeContext.Provider
      value={{ isDark, toggle: () => setIsDark((p) => !p) }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
