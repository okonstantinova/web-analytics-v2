import { useState } from 'react';
import type { FilterState } from '../types';

export const DEFAULT_MAX_COOKING_TIME = 180;
export const DEFAULT_MAX_CALORIES = 2000;

const initialFilters: FilterState = {
  search: '',
  mealType: '',
  cookingMethod: '',
  meatType: '',
  maxCookingTime: DEFAULT_MAX_COOKING_TIME,
  maxCalories: DEFAULT_MAX_CALORIES,
  isVegetarian: false,
  isVegan: false,
  difficulty: '',
};

export function useFilters() {
  const [filters, setFilters] = useState<FilterState>(initialFilters);

  function updateFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function resetFilters() {
    setFilters(initialFilters);
  }

  function applyScenario(overrides: Partial<FilterState>) {
    setFilters({ ...initialFilters, ...overrides });
  }

  return { filters, updateFilter, resetFilters, applyScenario };
}
