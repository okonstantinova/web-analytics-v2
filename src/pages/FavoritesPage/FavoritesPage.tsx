import { InfoCircleOutlined } from '@ant-design/icons';
import { useFavorites } from '../../context/FavoritesContext';
import { getAllRecipes } from '../../services/recipeService';
import RecipeCard from '../../components/RecipeCard/RecipeCard';
import './FavoritesPage.css';

const allRecipes = getAllRecipes();

export default function FavoritesPage() {
  const { favorites } = useFavorites();
  const favoriteRecipes = allRecipes.filter(r => favorites.includes(r.id));

  return (
    <main className="favorites-page">
      <div className="favorites-header">
        <h2 className="favorites-title">Избранное</h2>
        <p className="favorites-notice">
          <InfoCircleOutlined className="favorites-notice-icon" />
          Избранное хранится в вашем браузере. Список будет сброшен при очистке данных сайта или смене устройства.
        </p>
      </div>

      {favoriteRecipes.length === 0 ? (
        <div className="favorites-empty">
          <span className="favorites-empty-icon">♡</span>
          <p>Здесь пока пусто</p>
          <p className="favorites-empty-hint">
            Нажмите на сердечко на карточке рецепта, чтобы добавить его в избранное
          </p>
        </div>
      ) : (
        <div className="favorites-grid">
          {favoriteRecipes.map(recipe => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      )}
    </main>
  );
}
