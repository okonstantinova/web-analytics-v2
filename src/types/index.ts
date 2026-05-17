export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type CookingMethod = 'boiling' | 'oven' | 'frying' | 'steaming' | 'grilling' | 'raw' | 'mixed';
export type MeatType = 'chicken' | 'beef' | 'pork' | 'fish' | 'seafood' | 'lamb' | 'turkey' | 'none';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Ingredient {
  name: string;
  amount: string;
  unit: string;
}

export interface Recipe {
  id: string;
  name: string;
  shortDescription: string;
  description: string;
  calories: number;
  cookingTime: number;
  servings: number;
  mealType: MealType;
  cookingMethod: CookingMethod;
  meatType: MeatType;
  isVegetarian: boolean;
  isVegan: boolean;
  difficulty: Difficulty;
  ingredients: Ingredient[];
  steps: string[];
}

export interface FilterState {
  search: string;
  mealType: MealType | '';
  cookingMethod: CookingMethod | '';
  meatType: MeatType | '';
  maxCookingTime: number;
  maxCalories: number;
  isVegetarian: boolean;
  isVegan: boolean;
  difficulty: Difficulty | '';
}

export interface YandexMetrika {
  (counterId: number, action: string, ...args: unknown[]): void;
}

declare global {
  interface Window {
    ym: YandexMetrika;
    dataLayer: unknown[];
  }
}
