import { useCallback, useEffect, useRef } from 'react';
import type { FilterState } from '../../types';
import { useFilters, DEFAULT_MAX_COOKING_TIME, DEFAULT_MAX_CALORIES } from '../../hooks/useFilters';
import { useRecipes } from '../../hooks/useRecipes';
import {
  trackSearchPerformed,
  trackSearchZeroResults,
  trackFilterApplied,
  trackFilterComboApplied,
  trackFilterReset,
} from '../../services/analyticsService';
import SearchBar from '../../components/SearchBar/SearchBar';
import FilterPanel from '../../components/FilterPanel/FilterPanel';
import RecipeList from '../../components/RecipeList/RecipeList';
import './HomePage.css';

function buildFilterCombo(filters: FilterState): Record<string, string | number | boolean> {
  return {
    meal_type: filters.mealType || 'any',
    cooking_method: filters.cookingMethod || 'any',
    meat_type: filters.meatType || 'any',
    difficulty: filters.difficulty || 'any',
    max_cooking_time: filters.maxCookingTime,
    max_calories: filters.maxCalories,
    is_vegetarian: filters.isVegetarian,
    is_vegan: filters.isVegan,
    has_search: filters.search.length >= 2,
  };
}

export default function HomePage() {
  const { filters, updateFilter, resetFilters } = useFilters();
  const recipes = useRecipes(filters);

  const handleSearchChange = useCallback(
    (value: string) => {
      updateFilter('search', value);
      if (value.length >= 2) {
        trackSearchPerformed(value);
      }
    },
    [updateFilter],
  );

  function handleUpdateFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    updateFilter(key, value);
    trackFilterApplied(key, value as string | number | boolean);
    const nextFilters = { ...filters, [key]: value };
    trackFilterComboApplied(buildFilterCombo(nextFilters));
  }

  function handleReset() {
    resetFilters();
    trackFilterReset();
  }

  // search_zero_results: fire once per (query) when a non-trivial query
  // produces no recipes. Debounced so we don't fire on every keystroke.
  const lastZeroQueryRef = useRef<string>('');
  useEffect(() => {
    const q = filters.search.trim();
    const filtersUntouched =
      !filters.mealType &&
      !filters.cookingMethod &&
      !filters.meatType &&
      !filters.difficulty &&
      filters.maxCookingTime === DEFAULT_MAX_COOKING_TIME &&
      filters.maxCalories === DEFAULT_MAX_CALORIES &&
      !filters.isVegetarian &&
      !filters.isVegan;

    if (q.length < 2 || recipes.length !== 0 || !filtersUntouched) {
      if (recipes.length !== 0 || q.length < 2) lastZeroQueryRef.current = '';
      return;
    }
    if (q === lastZeroQueryRef.current) return;

    const t = window.setTimeout(() => {
      lastZeroQueryRef.current = q;
      trackSearchZeroResults(q);
    }, 600);
    return () => window.clearTimeout(t);
  }, [filters, recipes.length]);

  return (
    <main className="home-page">
      <div className="home-hero">
        <h2 className="home-hero-title">Найдите рецепт по вкусу</h2>
        <p className="home-hero-subtitle">
          Поиск по названию, ингредиентам или настройте фильтры вручную
        </p>
        <SearchBar value={filters.search} onChange={handleSearchChange} />
      </div>

      <div className="home-content">
        <section className="home-filters">
          <FilterPanel
            filters={filters}
            onUpdateFilter={handleUpdateFilter}
            onReset={handleReset}
          />
        </section>

        <section className="home-results">
          <div className="home-results-count">
            {recipes.length === 150 ? (
              <span>Все рецепты — {recipes.length}</span>
            ) : (
              <span>Найдено: {recipes.length}</span>
            )}
          </div>
          <RecipeList recipes={recipes} searchQuery={filters.search} />
        </section>
      </div>
    </main>
  );
}
