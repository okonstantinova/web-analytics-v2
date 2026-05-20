import type { Recipe, FilterState } from '../types';
import recipes1 from '../data/recipes-1.json';
import recipes2 from '../data/recipes-2.json';
import recipes3 from '../data/recipes-3.json';

const allRecipes: Recipe[] = [
  ...(recipes1 as unknown as Recipe[]),
  ...(recipes2 as unknown as Recipe[]),
  ...(recipes3 as unknown as Recipe[]),
];

export function getAllRecipes(): Recipe[] {
  return allRecipes;
}

export function getRecipeById(id: string): Recipe | undefined {
  return allRecipes.find((r) => r.id === id);
}

export function getSimilarRecipes(current: Recipe, limit = 4): Recipe[] {
  const scored = allRecipes
    .filter((r) => r.id !== current.id)
    .map((r) => {
      let score = 0;
      if (current.meatType !== 'none' && r.meatType === current.meatType) score += 3;
      if (r.mealType === current.mealType) score += 2;
      if (r.cookingMethod === current.cookingMethod) score += 2;
      if (Math.abs(r.cookingTime - current.cookingTime) <= 10) score += 1;
      if (Math.abs(r.calories - current.calories) <= 100) score += 1;
      if (r.difficulty === current.difficulty) score += 1;
      if (current.isVegan && r.isVegan) score += 1;
      else if (current.isVegetarian && r.isVegetarian) score += 1;
      return { recipe: r, score };
    })
    .sort((a, b) => b.score - a.score || a.recipe.name.localeCompare(b.recipe.name));

  return scored.slice(0, limit).map((s) => s.recipe);
}

export function filterRecipes(recipes: Recipe[], filters: FilterState): Recipe[] {
  return recipes.filter((recipe) => {
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const matched =
        recipe.name.toLowerCase().includes(q) ||
        recipe.shortDescription.toLowerCase().includes(q) ||
        recipe.description.toLowerCase().includes(q) ||
        recipe.ingredients.some((ing) => ing.name.toLowerCase().includes(q));
      if (!matched) return false;
    }

    if (filters.mealType && recipe.mealType !== filters.mealType) return false;
    if (filters.cookingMethod && recipe.cookingMethod !== filters.cookingMethod) return false;
    if (filters.meatType && recipe.meatType !== filters.meatType) return false;
    if (filters.difficulty && recipe.difficulty !== filters.difficulty) return false;
    if (recipe.cookingTime > filters.maxCookingTime) return false;
    if (recipe.calories > filters.maxCalories) return false;
    if (filters.isVegetarian && !recipe.isVegetarian) return false;
    if (filters.isVegan && !recipe.isVegan) return false;

    return true;
  });
}
