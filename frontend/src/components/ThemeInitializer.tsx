import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../store";
import { setTheme } from "../store/slices/uiSlice";

const ThemeInitializer: React.FC = () => {
  const dispatch = useDispatch();
  const theme = useSelector((state: RootState) => state.ui.theme);

  useEffect(() => {
    // Force light mode - disable dark mode completely
    const initialTheme = "light";

    // Set the theme in Redux store
    dispatch(setTheme(initialTheme));

    // Apply theme to document - ensure no dark class
    document.documentElement.classList.remove("dark");

    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute("content", "#ffffff");
    }
  }, [dispatch]);

  useEffect(() => {
    // Force light mode - always remove dark class
    document.documentElement.classList.remove("dark");

    // Update meta theme-color for mobile browsers - always light
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute("content", "#ffffff");
    }

    // Persist light theme to localStorage
    localStorage.setItem("theme", "light");
  }, [theme]);

  return null; // This component doesn't render anything
};

export default ThemeInitializer;
