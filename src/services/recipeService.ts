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
