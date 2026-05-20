import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { getRecipeById } from '../services/recipeService';
import { trackFavoriteAdded, trackFavoriteRemoved } from '../services/analyticsService';

interface FavoritesContextType {
  favorites: string[];
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
}

const FavoritesContext = createContext<FavoritesContextType>({
  favorites: [],
  toggleFavorite: () => {},
  isFavorite: () => false,
});

const STORAGE_KEY = 'khrum_favorites';

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as string[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  }, [favorites]);

  function toggleFavorite(id: string) {
    setFavorites(prev => {
      const wasFavorite = prev.includes(id);
      const name = getRecipeById(id)?.name ?? '';
      if (wasFavorite) {
        trackFavoriteRemoved(id, name);
        return prev.filter(f => f !== id);
      }
      trackFavoriteAdded(id, name);
      return [...prev, id];
    });
  }

  function isFavorite(id: string) {
    return favorites.includes(id);
  }

  return (
    <FavoritesContext.Provider value={{ favorites, toggleFavorite, isFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  return useContext(FavoritesContext);
}
