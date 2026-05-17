import { Select, Slider, Switch, Button } from 'antd';
import type { FilterState, MealType, CookingMethod, MeatType, Difficulty } from '../../types';
import { DEFAULT_MAX_CALORIES, DEFAULT_MAX_COOKING_TIME } from '../../hooks/useFilters';
import { trackFilterApplied, trackFilterReset } from '../../services/analyticsService';
import './FilterPanel.css';

interface FilterPanelProps {
  filters: FilterState;
  onUpdateFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  onReset: () => void;
}

const mealTypeOptions = [
  { value: 'breakfast', label: 'Завтрак' },
  { value: 'lunch', label: 'Обед' },
  { value: 'dinner', label: 'Ужин' },
  { value: 'snack', label: 'Перекус' },
];

const cookingMethodOptions = [
  { value: 'boiling', label: 'Варка' },
  { value: 'oven', label: 'Духовка' },
  { value: 'frying', label: 'Жарка' },
  { value: 'steaming', label: 'Паровая готовка' },
  { value: 'grilling', label: 'Гриль' },
  { value: 'raw', label: 'Без готовки' },
  { value: 'mixed', label: 'Смешанный' },
];

const meatTypeOptions = [
  { value: 'chicken', label: 'Курица' },
  { value: 'beef', label: 'Говядина' },
  { value: 'pork', label: 'Свинина' },
  { value: 'fish', label: 'Рыба' },
  { value: 'seafood', label: 'Морепродукты' },
  { value: 'lamb', label: 'Баранина' },
  { value: 'turkey', label: 'Индейка' },
  { value: 'none', label: 'Без мяса' },
];

const difficultyOptions = [
  { value: 'easy', label: 'Лёгкий' },
  { value: 'medium', label: 'Средний' },
  { value: 'hard', label: 'Сложный' },
];

export default function FilterPanel({ filters, onUpdateFilter, onReset }: FilterPanelProps) {
  function handleFilterChange<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    onUpdateFilter(key, value);
    trackFilterApplied(key, value as string | number | boolean);
  }

  function handleReset() {
    onReset();
    trackFilterReset();
  }

  const hasActiveFilters =
    filters.mealType !== '' ||
    filters.cookingMethod !== '' ||
    filters.meatType !== '' ||
    filters.difficulty !== '' ||
    filters.maxCookingTime !== DEFAULT_MAX_COOKING_TIME ||
    filters.maxCalories !== DEFAULT_MAX_CALORIES ||
    filters.isVegetarian ||
    filters.isVegan;

  return (
    <div className="filter-panel">
      <div className="filter-row filter-row--selects">
        <div className="filter-group">
          <label className="filter-label">Приём пищи</label>
          <Select
            placeholder="Любой"
            value={filters.mealType || undefined}
            onChange={(v) => handleFilterChange('mealType', (v ?? '') as MealType | '')}
            options={mealTypeOptions}
            allowClear
            className="filter-select"
          />
        </div>

        <div className="filter-group">
          <label className="filter-label">Способ приготовления</label>
          <Select
            placeholder="Любой"
            value={filters.cookingMethod || undefined}
            onChange={(v) => handleFilterChange('cookingMethod', (v ?? '') as CookingMethod | '')}
            options={cookingMethodOptions}
            allowClear
            className="filter-select"
          />
        </div>

        <div className="filter-group">
          <label className="filter-label">Тип мяса</label>
          <Select
            placeholder="Любой"
            value={filters.meatType || undefined}
            onChange={(v) => handleFilterChange('meatType', (v ?? '') as MeatType | '')}
            options={meatTypeOptions}
            allowClear
            className="filter-select"
          />
        </div>

        <div className="filter-group">
          <label className="filter-label">Сложность</label>
          <Select
            placeholder="Любая"
            value={filters.difficulty || undefined}
            onChange={(v) => handleFilterChange('difficulty', (v ?? '') as Difficulty | '')}
            options={difficultyOptions}
            allowClear
            className="filter-select"
          />
        </div>
      </div>

      <div className="filter-row filter-row--controls">
        <div className="filter-group filter-group--slider">
          <label className="filter-label">
            Время готовки: до
            <span className="filter-label-num">{filters.maxCookingTime}&thinsp;мин</span>
          </label>
          <Slider
            min={5}
            max={DEFAULT_MAX_COOKING_TIME}
            value={filters.maxCookingTime}
            onChange={(v) => handleFilterChange('maxCookingTime', v)}
            tooltip={{ formatter: (v) => `${v} мин` }}
          />
        </div>

        <div className="filter-group filter-group--slider">
          <label className="filter-label">
            Калории: до
            <span className="filter-label-num">{filters.maxCalories}&thinsp;ккал</span>
          </label>
          <Slider
            min={50}
            max={DEFAULT_MAX_CALORIES}
            step={50}
            value={filters.maxCalories}
            onChange={(v) => handleFilterChange('maxCalories', v)}
            tooltip={{ formatter: (v) => `${v} ккал` }}
          />
        </div>

        <div className="filter-group filter-group--toggle">
          <label className="filter-label">Вегетарианское</label>
          <Switch
            checked={filters.isVegetarian}
            onChange={(v) => handleFilterChange('isVegetarian', v)}
          />
        </div>

        <div className="filter-group filter-group--toggle">
          <label className="filter-label">Веганское</label>
          <Switch
            checked={filters.isVegan}
            onChange={(v) => handleFilterChange('isVegan', v)}
          />
        </div>

        <div className="filter-group filter-group--reset" aria-hidden={!hasActiveFilters}>
          <Button
            onClick={handleReset}
            className="filter-reset-btn"
            style={{ visibility: hasActiveFilters ? 'visible' : 'hidden' }}
          >
            Сбросить фильтры
          </Button>
        </div>
      </div>
    </div>
  );
}
