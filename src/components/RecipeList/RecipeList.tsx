import type { Recipe } from '../../types';
import RecipeCard from '../RecipeCard/RecipeCard';
import './RecipeList.css';

interface RecipeListProps {
  recipes: Recipe[];
  searchQuery?: string;
}

export default function RecipeList({ recipes, searchQuery }: RecipeListProps) {
  if (recipes.length === 0) {
    return (
      <div className="recipe-list-empty">
        <p className="recipe-list-empty-title">Рецепты не найдены</p>
        <p className="recipe-list-empty-hint">
          Попробуйте изменить параметры фильтров или поискового запроса
        </p>
      </div>
    );
  }

  return (
    <div className="recipe-list">
      {recipes.map((recipe, index) => (
        <RecipeCard
          key={recipe.id}
          recipe={recipe}
          searchQuery={searchQuery}
          position={index + 1}
        />
      ))}
    </div>
  );
}
