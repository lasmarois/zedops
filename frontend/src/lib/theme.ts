/**
 * Theme System
 *
 * 6 themes stored as CSS variable maps. Theme preference is saved per-user
 * in D1 and also cached in localStorage for instant boot (no FOUC).
 */

import { getToken } from './auth';

const API_BASE = window.location.origin;

export interface Theme {
  id: string;
  name: string;
  description: string;
  colors: Record<string, string>;
  preview: {
    background: string;
    primary: string;
    info: string;
    success: string;
  };
}

export const THEMES: Theme[] = [
  {
    id: 'midnight-blue',
    name: 'Midnight Blue',
    description: 'Professional blue tones',
    preview: {
      background: '220 45% 12%',
      primary: '217 91% 60%',
      info: '199 92% 65%',
      success: '142 71% 65%',
    },
    colors: {
      '--background': '220 45% 12%',
      '--foreground': '210 40% 98%',
      '--card': '220 40% 16%',
      '--card-foreground': '210 40% 98%',
      '--popover': '220 40% 16%',
      '--popover-foreground': '210 40% 98%',
      '--primary': '217 91% 60%',
      '--primary-foreground': '220 45% 12%',
      '--secondary': '217 32% 20%',
      '--secondary-foreground': '210 40% 98%',
      '--muted': '217 32% 18%',
      '--muted-foreground': '215 20% 70%',
      '--accent': '217 32% 20%',
      '--accent-foreground': '210 40% 98%',
      '--destructive': '0 84% 60%',
      '--destructive-foreground': '210 40% 98%',
      '--success': '142 71% 65%',
      '--warning': '38 95% 65%',
      '--error': '0 88% 68%',
      '--info': '199 92% 65%',
      '--border': '217 32% 30%',
      '--input': '217 32% 30%',
      '--ring': '217 91% 60%',
      '--chart-1': '217 91% 60%',
      '--chart-2': '142 76% 60%',
      '--chart-3': '38 92% 60%',
      '--chart-4': '280 87% 65%',
      '--chart-5': '340 82% 60%',
    },
  },
  {
    id: 'cyberpunk-neon',
    name: 'Cyberpunk Neon',
    description: 'Vibrant pink & purple',
    preview: {
      background: '270 50% 8%',
      primary: '330 90% 60%',
      info: '185 95% 55%',
      success: '160 80% 55%',
    },
    colors: {
      '--background': '270 50% 8%',
      '--foreground': '300 20% 95%',
      '--card': '270 45% 12%',
      '--card-foreground': '300 20% 95%',
      '--popover': '270 45% 12%',
      '--popover-foreground': '300 20% 95%',
      '--primary': '330 90% 60%',
      '--primary-foreground': '270 50% 8%',
      '--secondary': '280 40% 18%',
      '--secondary-foreground': '300 20% 95%',
      '--muted': '275 35% 15%',
      '--muted-foreground': '280 15% 65%',
      '--accent': '280 40% 18%',
      '--accent-foreground': '300 20% 95%',
      '--destructive': '0 85% 55%',
      '--destructive-foreground': '300 20% 95%',
      '--success': '160 80% 55%',
      '--warning': '45 95% 60%',
      '--error': '350 90% 60%',
      '--info': '185 95% 55%',
      '--border': '280 30% 28%',
      '--input': '280 30% 28%',
      '--ring': '330 90% 60%',
      '--chart-1': '330 90% 60%',
      '--chart-2': '160 80% 55%',
      '--chart-3': '45 95% 60%',
      '--chart-4': '185 95% 55%',
      '--chart-5': '270 80% 65%',
    },
  },
  {
    id: 'emerald-dark',
    name: 'Emerald Dark',
    description: 'Forest green vibes',
    preview: {
      background: '160 40% 7%',
      primary: '152 76% 50%',
      info: '180 70% 55%',
      success: '142 70% 55%',
    },
    colors: {
      '--background': '160 40% 7%',
      '--foreground': '150 20% 95%',
      '--card': '160 35% 11%',
      '--card-foreground': '150 20% 95%',
      '--popover': '160 35% 11%',
      '--popover-foreground': '150 20% 95%',
      '--primary': '152 76% 50%',
      '--primary-foreground': '160 40% 7%',
      '--secondary': '155 30% 16%',
      '--secondary-foreground': '150 20% 95%',
      '--muted': '158 28% 14%',
      '--muted-foreground': '155 15% 60%',
      '--accent': '155 30% 16%',
      '--accent-foreground': '150 20% 95%',
      '--destructive': '0 72% 55%',
      '--destructive-foreground': '150 20% 95%',
      '--success': '142 70% 55%',
      '--warning': '45 90% 58%',
      '--error': '0 75% 60%',
      '--info': '180 70% 55%',
      '--border': '155 25% 25%',
      '--input': '155 25% 25%',
      '--ring': '152 76% 50%',
      '--chart-1': '152 76% 50%',
      '--chart-2': '180 70% 55%',
      '--chart-3': '45 90% 58%',
      '--chart-4': '120 60% 55%',
      '--chart-5': '200 70% 55%',
    },
  },
  {
    id: 'amber-forge',
    name: 'Amber Forge',
    description: 'Warm industrial gold',
    preview: {
      background: '25 30% 9%',
      primary: '38 92% 55%',
      info: '200 70% 58%',
      success: '150 65% 50%',
    },
    colors: {
      '--background': '25 30% 9%',
      '--foreground': '35 30% 93%',
      '--card': '25 25% 13%',
      '--card-foreground': '35 30% 93%',
      '--popover': '25 25% 13%',
      '--popover-foreground': '35 30% 93%',
      '--primary': '38 92% 55%',
      '--primary-foreground': '25 30% 9%',
      '--secondary': '30 22% 18%',
      '--secondary-foreground': '35 30% 93%',
      '--muted': '28 20% 15%',
      '--muted-foreground': '30 15% 60%',
      '--accent': '30 22% 18%',
      '--accent-foreground': '35 30% 93%',
      '--destructive': '0 75% 55%',
      '--destructive-foreground': '35 30% 93%',
      '--success': '150 65% 50%',
      '--warning': '30 95% 60%',
      '--error': '5 80% 58%',
      '--info': '200 70% 58%',
      '--border': '30 20% 26%',
      '--input': '30 20% 26%',
      '--ring': '38 92% 55%',
      '--chart-1': '38 92% 55%',
      '--chart-2': '20 85% 55%',
      '--chart-3': '150 65% 50%',
      '--chart-4': '200 70% 58%',
      '--chart-5': '350 70% 55%',
    },
  },
  {
    id: 'arctic-frost',
    name: 'Arctic Frost',
    description: 'Cool ice blue tones',
    preview: {
      background: '220 25% 10%',
      primary: '200 80% 62%',
      info: '245 58% 68%',
      success: '158 55% 52%',
    },
    colors: {
      '--background': '220 25% 10%',
      '--foreground': '210 30% 96%',
      '--card': '218 22% 14%',
      '--card-foreground': '210 30% 96%',
      '--popover': '218 22% 14%',
      '--popover-foreground': '210 30% 96%',
      '--primary': '200 80% 62%',
      '--primary-foreground': '220 25% 10%',
      '--secondary': '215 20% 18%',
      '--secondary-foreground': '210 30% 96%',
      '--muted': '216 18% 16%',
      '--muted-foreground': '215 15% 62%',
      '--accent': '215 20% 18%',
      '--accent-foreground': '210 30% 96%',
      '--destructive': '0 65% 55%',
      '--destructive-foreground': '210 30% 96%',
      '--success': '158 55% 52%',
      '--warning': '42 75% 58%',
      '--error': '355 65% 58%',
      '--info': '245 58% 68%',
      '--border': '215 18% 28%',
      '--input': '215 18% 28%',
      '--ring': '200 80% 62%',
      '--chart-1': '200 80% 62%',
      '--chart-2': '245 58% 68%',
      '--chart-3': '158 55% 52%',
      '--chart-4': '42 75% 58%',
      '--chart-5': '180 50% 55%',
    },
  },
  {
    id: 'solar-flare',
    name: 'Solar Flare',
    description: 'Fiery orange energy',
    preview: {
      background: '15 35% 8%',
      primary: '25 95% 55%',
      info: '45 95% 60%',
      success: '145 65% 48%',
    },
    colors: {
      '--background': '15 35% 8%',
      '--foreground': '40 40% 95%',
      '--card': '15 30% 12%',
      '--card-foreground': '40 40% 95%',
      '--popover': '15 30% 12%',
      '--popover-foreground': '40 40% 95%',
      '--primary': '25 95% 55%',
      '--primary-foreground': '15 35% 8%',
      '--secondary': '18 25% 17%',
      '--secondary-foreground': '40 40% 95%',
      '--muted': '16 22% 14%',
      '--muted-foreground': '20 15% 58%',
      '--accent': '18 25% 17%',
      '--accent-foreground': '40 40% 95%',
      '--destructive': '355 80% 55%',
      '--destructive-foreground': '40 40% 95%',
      '--success': '145 65% 48%',
      '--warning': '48 95% 55%',
      '--error': '0 80% 58%',
      '--info': '45 95% 60%',
      '--border': '18 20% 25%',
      '--input': '18 20% 25%',
      '--ring': '25 95% 55%',
      '--chart-1': '25 95% 55%',
      '--chart-2': '48 95% 55%',
      '--chart-3': '0 80% 58%',
      '--chart-4': '145 65% 48%',
      '--chart-5': '15 90% 65%',
    },
  },
];

const STORAGE_KEY = 'zedops_theme';

/** Apply a theme's CSS variables to :root */
function setThemeVars(theme: Theme) {
  const root = document.documentElement;
  for (const [prop, value] of Object.entries(theme.colors)) {
    root.style.setProperty(prop, value);
  }
}

/** Get current theme ID from localStorage */
export function getTheme(): string {
  return localStorage.getItem(STORAGE_KEY) || 'midnight-blue';
}

/** Apply a theme by ID — updates CSS vars, saves to localStorage, and persists to backend */
export function applyTheme(id: string, persistToBackend = true) {
  const theme = THEMES.find((t) => t.id === id);
  if (!theme) return;

  setThemeVars(theme);
  localStorage.setItem(STORAGE_KEY, id);

  if (persistToBackend) {
    const token = getToken();
    if (token) {
      fetch(`${API_BASE}/api/preferences`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ theme: id }),
      }).catch(() => {
        // Non-critical — localStorage already saved
      });
    }
  }
}

/**
 * Called once at app boot, before React renders.
 * Applies saved theme from localStorage instantly to prevent FOUC.
 */
export function initTheme() {
  const id = getTheme();
  if (id !== 'midnight-blue') {
    const theme = THEMES.find((t) => t.id === id);
    if (theme) setThemeVars(theme);
  }
}

/**
 * Called after login to sync theme from backend.
 * If backend has a different theme than localStorage, apply it.
 */
export function syncThemeFromUser(themeFromBackend: string | null | undefined) {
  const backendTheme = themeFromBackend || 'midnight-blue';
  const localTheme = getTheme();

  if (backendTheme !== localTheme) {
    applyTheme(backendTheme, false); // Don't persist back — it's already in backend
  }
}
