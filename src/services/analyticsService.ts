const COUNTER_ID = 109042107;

function ym(method: string, ...args: unknown[]) {
  if (typeof window !== 'undefined' && typeof window.ym === 'function') {
    window.ym(COUNTER_ID, method, ...args);
  }
}

// SPA navigation — called on every route change
export function trackPageHit(url: string) {
  ym('hit', url, { title: document.title });
}

// Recipe list
export function trackRecipeCardClick(recipeId: string | number, recipeName: string) {
  ym('reachGoal', 'recipe_card_click', { recipe_id: recipeId, recipe_name: recipeName });
}

// Recipe page
export function trackRecipeView(recipeId: string | number, recipeName: string) {
  ym('reachGoal', 'recipe_view', { recipe_id: recipeId, recipe_name: recipeName });
}

// Scroll depth on recipe page — fires at 25 / 50 / 75 / 100 %
export function trackRecipeScroll(recipeId: string | number, recipeName: string, depthPct: number) {
  ym('reachGoal', 'recipe_scroll', { recipe_id: recipeId, recipe_name: recipeName, depth_pct: depthPct });
}

// Time spent on recipe page (seconds), fires on page leave
export function trackRecipeTimeSpent(recipeId: string | number, recipeName: string, seconds: number) {
  ym('reachGoal', 'recipe_time_spent', { recipe_id: recipeId, recipe_name: recipeName, seconds });
}

// Popular scenario chip click
export function trackScenarioClick(scenarioId: string, scenarioLabel: string) {
  ym('reachGoal', 'scenario_click', { scenario_id: scenarioId, scenario_label: scenarioLabel });
}

// Filters
export function trackFilterApplied(filterType: string, value: string | number | boolean) {
  ym('reachGoal', 'filter_applied', { filter_type: filterType, value });
}

export function trackFilterReset() {
  ym('reachGoal', 'filter_reset');
}

// Search
export function trackSearchPerformed(query: string) {
  ym('reachGoal', 'search_performed', { query });
}

// Search returned zero results
export function trackSearchZeroResults(query: string) {
  ym('reachGoal', 'search_zero_results', { query });
}

// User clicked a recipe card while a search query was active
export function trackSearchResultClicked(query: string, recipeId: string | number, recipeName: string, position: number) {
  ym('reachGoal', 'search_result_clicked', {
    query,
    recipe_id: recipeId,
    recipe_name: recipeName,
    position,
  });
}

// Full filter combination at the moment a filter was applied
export function trackFilterComboApplied(combo: Record<string, string | number | boolean>) {
  ym('reachGoal', 'filter_combo_applied', combo);
}

// Favorites
export function trackFavoriteAdded(recipeId: string | number, recipeName: string) {
  ym('reachGoal', 'favorite_added', { recipe_id: recipeId, recipe_name: recipeName });
}

export function trackFavoriteRemoved(recipeId: string | number, recipeName: string) {
  ym('reachGoal', 'favorite_removed', { recipe_id: recipeId, recipe_name: recipeName });
}

// Fires once per session if user interacts within engagementWindowMs
export function trackEngagedSession() {
  ym('reachGoal', 'engaged_session');
}

// Recipe read to completion: scroll 100% + at least readSeconds time spent
export function trackRecipeReadComplete(recipeId: string | number, recipeName: string, seconds: number) {
  ym('reachGoal', 'recipe_read_complete', {
    recipe_id: recipeId,
    recipe_name: recipeName,
    seconds,
  });
}

// Web Vitals — sends a Metrika "params" payload, viewable as user parameters
export function trackWebVital(name: string, value: number, rating: string) {
  ym('params', { web_vitals: { [name]: { value: Math.round(value), rating } } });
}
