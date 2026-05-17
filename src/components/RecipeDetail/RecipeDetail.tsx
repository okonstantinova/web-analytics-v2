import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftOutlined,
  ClockCircleOutlined,
  FireOutlined,
  TeamOutlined,
  TrophyOutlined,
  HeartOutlined,
  HeartFilled,
} from '@ant-design/icons';
import type { Recipe } from '../../types';
import { getRecipeImage } from '../../services/imageService';
import { useFavorites } from '../../context/FavoritesContext';
import './RecipeDetail.css';

interface RecipeDetailProps {
  recipe: Recipe;
}

const difficultyLabels: Record<string, string> = {
  easy: 'Лёгкий',
  medium: 'Средний',
  hard: 'Сложный',
};

const mealTypeLabels: Record<string, string> = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  dinner: 'Ужин',
  snack: 'Перекус',
};

export default function RecipeDetail({ recipe }: RecipeDetailProps) {
  const navigate = useNavigate();
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorited = isFavorite(recipe.id);

  function handleBack() {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  }

  return (
    <div className="recipe-detail">
      <div className="recipe-detail-back">
        <button className="recipe-detail-back-btn" onClick={handleBack}>
          <ArrowLeftOutlined />
          <span>Назад к рецептам</span>
        </button>
      </div>

      <div className="recipe-detail-hero">
        <img
          src={getRecipeImage(recipe)}
          alt={recipe.name}
          className="recipe-detail-hero-img"
        />
        <div className="recipe-detail-hero-overlay">
          <div className="recipe-detail-badge">{mealTypeLabels[recipe.mealType]}</div>
          <h1 className="recipe-detail-title">{recipe.name}</h1>
        </div>
        <button
          className={`recipe-detail-heart${favorited ? ' recipe-detail-heart--active' : ''}`}
          onClick={() => toggleFavorite(recipe.id)}
          aria-label={favorited ? 'Убрать из избранного' : 'Добавить в избранное'}
        >
          {favorited ? <HeartFilled /> : <HeartOutlined />}
        </button>
      </div>

      <p className="recipe-detail-description">{recipe.description}</p>

      <div className="recipe-detail-stats">
        <div className="recipe-detail-stat">
          <FireOutlined className="stat-icon" />
          <span className="stat-value">{recipe.calories}</span>
          <span className="stat-label">ккал</span>
        </div>
        <div className="recipe-detail-stat">
          <ClockCircleOutlined className="stat-icon" />
          <span className="stat-value">{recipe.cookingTime}</span>
          <span className="stat-label">минут</span>
        </div>
        <div className="recipe-detail-stat">
          <TeamOutlined className="stat-icon" />
          <span className="stat-value">{recipe.servings}</span>
          <span className="stat-label">порции</span>
        </div>
        <div className="recipe-detail-stat">
          <TrophyOutlined className="stat-icon" />
          <span className="stat-value">{difficultyLabels[recipe.difficulty]}</span>
          <span className="stat-label">сложность</span>
        </div>
      </div>

      <div className="recipe-detail-content">
        <div className="recipe-detail-ingredients">
          <h2 className="recipe-detail-section-title">Ингредиенты</h2>
          <ul className="ingredients-list">
            {recipe.ingredients.map((ing, idx) => (
              <li key={idx} className="ingredient-item">
                <span className="ingredient-name">{ing.name}</span>
                <span className="ingredient-dots" />
                <span className="ingredient-amount">
                  {ing.amount} {ing.unit}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="recipe-detail-steps">
          <h2 className="recipe-detail-section-title">Приготовление</h2>
          <ol className="steps-list">
            {recipe.steps.map((step, idx) => (
              <li key={idx} className="step-item">
                <span className="step-number">{idx + 1}</span>
                <span className="step-text">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
