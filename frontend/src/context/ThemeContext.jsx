import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";


const ThemeContext =
  createContext(null);


export function ThemeProvider({
  children,
}) {

  const [theme, setTheme] =
    useState(() => {

      const savedTheme =
        localStorage.getItem(
          "treenotes-theme"
        );


      if (savedTheme) {
        return savedTheme;
      }


      /*
        On first visit, respect the user's
        operating-system preference.
      */

      const prefersDark =
        window.matchMedia(
          "(prefers-color-scheme: dark)"
        ).matches;


      return prefersDark
        ? "dark"
        : "light";

    });


  useEffect(() => {

    document.documentElement
      .setAttribute(
        "data-theme",
        theme
      );


    localStorage.setItem(
      "treenotes-theme",
      theme
    );

  }, [theme]);


  function toggleTheme() {

    setTheme((current) =>
      current === "dark"
        ? "light"
        : "dark"
    );

  }


  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}


export function useTheme() {

  const context =
    useContext(ThemeContext);


  if (!context) {
    throw new Error(
      "useTheme must be used inside ThemeProvider."
    );
  }


  return context;
}