import type { Recipe } from '../../types';
import RecipeCard from '../RecipeCard/RecipeCard';
import './RecipeList.css';

interface RecipeListProps {
  recipes: Recipe[];
}

export default function RecipeList({ recipes }: RecipeListProps) {
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
      {recipes.map((recipe) => (
        <RecipeCard key={recipe.id} recipe={recipe} />
      ))}
    </div>
  );
}
