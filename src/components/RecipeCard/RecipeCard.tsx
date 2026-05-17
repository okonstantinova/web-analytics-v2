import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { ClockCircleOutlined, FireOutlined, HeartOutlined, HeartFilled } from '@ant-design/icons';
import { Tag } from 'antd';
import type { Recipe } from '../../types';
import { trackRecipeCardClick } from '../../services/analyticsService';
import { getRecipeImage } from '../../services/imageService';
import { useFavorites } from '../../context/FavoritesContext';
import './RecipeCard.css';

interface RecipeCardProps {
  recipe: Recipe;
}

const mealTypeLabels: Record<string, string> = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  dinner: 'Ужин',
  snack: 'Перекус',
};

export default function RecipeCard({ recipe }: RecipeCardProps) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorited = isFavorite(recipe.id);

  function handleClick() {
    trackRecipeCardClick(recipe.id, recipe.name);
  }

  function handleFavoriteClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(recipe.id);
  }

  return (
    <Link
      to={`/recipe/${recipe.id}`}
      className="recipe-card-link"
      onClick={handleClick}
    >
      <article className="recipe-card">
        <div className="recipe-card-image-wrap">
          <img
            src={getRecipeImage(recipe)}
            alt={recipe.name}
            className="recipe-card-image"
            loading="lazy"
          />
          <button
            className={`recipe-card-heart${favorited ? ' recipe-card-heart--active' : ''}`}
            onClick={handleFavoriteClick}
            aria-label={favorited ? 'Убрать из избранного' : 'Добавить в избранное'}
          >
            {favorited ? <HeartFilled /> : <HeartOutlined />}
          </button>
        </div>
        <div className="recipe-card-body">
          <div className="recipe-card-tags">
            <Tag className="recipe-card-tag recipe-card-tag--meal">
              {mealTypeLabels[recipe.mealType]}
            </Tag>
            {recipe.isVegan && (
              <Tag className="recipe-card-tag recipe-card-tag--vegan">Веганское</Tag>
            )}
            {recipe.isVegetarian && !recipe.isVegan && (
              <Tag className="recipe-card-tag recipe-card-tag--veg">Вегетарианское</Tag>
            )}
          </div>
          <h3 className="recipe-card-title">{recipe.name}</h3>
          <p className="recipe-card-desc">{recipe.shortDescription}</p>
          <div className="recipe-card-meta">
            <span className="recipe-card-meta-item">
              <ClockCircleOutlined />
              {recipe.cookingTime} мин
            </span>
            <span className="recipe-card-meta-item">
              <FireOutlined />
              {recipe.calories} ккал
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
