import type { Recipe } from '../types';

const BASE = import.meta.env.BASE_URL + 'dishes/';

export function getRecipeImage(recipe: Recipe): string {
  return BASE + recipe.id + '.jpg';
}

export const DISH_IMAGE_BASE = BASE;
