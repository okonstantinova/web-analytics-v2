import { useCallback } from 'react';
import type { FilterState } from '../../types';
import { useFilters } from '../../hooks/useFilters';
import { useRecipes } from '../../hooks/useRecipes';
import {
  trackSearchPerformed,
  trackFilterApplied,
  trackFilterReset,
} from '../../services/analyticsService';
import SearchBar from '../../components/SearchBar/SearchBar';
import FilterPanel from '../../components/FilterPanel/FilterPanel';
import RecipeList from '../../components/RecipeList/RecipeList';
import './HomePage.css';

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
  }

  function handleReset() {
    resetFilters();
    trackFilterReset();
  }

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
          <RecipeList recipes={recipes} />
        </section>
      </div>
    </main>
  );
}
