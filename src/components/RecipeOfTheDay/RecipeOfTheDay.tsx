import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClockCircleOutlined, FireOutlined, DashboardOutlined, ArrowRightOutlined, StarFilled } from '@ant-design/icons';
import { getRecipeOfTheDay } from '../../services/recipeService';
import { getRecipeImage } from '../../services/imageService';
import { trackRecipeCardClick } from '../../services/analyticsService';
import './RecipeOfTheDay.css';

const difficultyLabels: Record<string, string> = {
  easy: 'Просто',
  medium: 'Средне',
  hard: 'Сложно',
};

function msUntilLocalMidnight(): number {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}

export default function RecipeOfTheDay() {
  const [recipe, setRecipe] = useState(() => getRecipeOfTheDay());

  // Rotate at local midnight without a full reload, for users who keep the tab open.
  useEffect(() => {
    const t = window.setTimeout(() => setRecipe(getRecipeOfTheDay()), msUntilLocalMidnight() + 1000);
    return () => window.clearTimeout(t);
  }, [recipe.id]);

  function handleClick() {
    trackRecipeCardClick(recipe.id, recipe.name, 'hero');
  }

  return (
    <Link
      to={`/recipe/${recipe.id}`}
      className="rotd-link"
      onClick={handleClick}
      aria-label={`Рецепт дня: ${recipe.name}`}
    >
      <article className="rotd">
        <div className="rotd-image-wrap">
          <img
            src={getRecipeImage(recipe)}
            alt={recipe.name}
            className="rotd-image"
            loading="lazy"
          />
        </div>
        <div className="rotd-body">
          <span className="rotd-label">
            <StarFilled />
            Рецепт дня
          </span>
          <h2 className="rotd-title">{recipe.name}</h2>
          <p className="rotd-desc">{recipe.shortDescription}</p>
          <div className="rotd-meta">
            <span className="rotd-meta-item">
              <ClockCircleOutlined />
              {recipe.cookingTime} мин
            </span>
            <span className="rotd-meta-item">
              <FireOutlined />
              {recipe.calories} ккал
            </span>
            <span className="rotd-meta-item">
              <DashboardOutlined />
              {difficultyLabels[recipe.difficulty]}
            </span>
          </div>
          <span className="rotd-cta">
            Открыть рецепт
            <ArrowRightOutlined />
          </span>
        </div>
      </article>
    </Link>
  );
}
