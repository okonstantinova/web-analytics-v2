import { useMemo } from 'react';
import type { FilterState, Recipe } from '../types';
import { getAllRecipes, filterRecipes } from '../services/recipeService';

export function useRecipes(filters: FilterState): Recipe[] {
  const all = useMemo(() => getAllRecipes(), []);
  return useMemo(() => filterRecipes(all, filters), [all, filters]);
}
