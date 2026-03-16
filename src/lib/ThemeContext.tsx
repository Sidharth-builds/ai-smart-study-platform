import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './AuthContext';

export type Theme = 'system' | 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<Theme>('system');
  const [isDark, setIsDark] = useState(false);

  // Get system preference
  const getSystemTheme = (): boolean => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  };

  // Apply theme to document
  const applyTheme = (dark: boolean) => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    setIsDark(dark);
  };

  // Load theme from localStorage and Firestore
  useEffect(() => {
    const loadTheme = async () => {
      let savedTheme: Theme = 'system';

      // Check localStorage first
      const localTheme = localStorage.getItem('theme') as Theme;
      if (localTheme && ['system', 'light', 'dark'].includes(localTheme)) {
        savedTheme = localTheme;
      } else if (user) {
        // Check Firestore if user is logged in
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.theme && ['system', 'light', 'dark'].includes(userData.theme)) {
              savedTheme = userData.theme;
            }
          }
        } catch (error) {
          console.error('Error loading theme from Firestore:', error);
        }
      }

      setThemeState(savedTheme);
      const dark = savedTheme === 'dark' || (savedTheme === 'system' && getSystemTheme());
      applyTheme(dark);
    };

    loadTheme();
  }, [user]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme(getSystemTheme());
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);

    // Save to localStorage
    localStorage.setItem('theme', newTheme);

    // Save to Firestore if user is logged in
    if (user) {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, { theme: newTheme }, { merge: true });
      } catch (error) {
        console.error('Error saving theme to Firestore:', error);
      }
    }

    // Apply theme
    const dark = newTheme === 'dark' || (newTheme === 'system' && getSystemTheme());
    applyTheme(dark);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
};
