import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getRecipeById } from '../../services/recipeService';
import {
  trackRecipeView,
  trackRecipeScroll,
  trackRecipeTimeSpent,
} from '../../services/analyticsService';
import RecipeDetail from '../../components/RecipeDetail/RecipeDetail';
import './RecipePage.css';

export default function RecipePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const recipe = id ? getRecipeById(id) : undefined;

  // Track page view
  useEffect(() => {
    if (recipe) {
      trackRecipeView(recipe.id, recipe.name);
    } else if (id) {
      navigate('/', { replace: true });
    }
  }, [recipe, id, navigate]);

  // Track time spent — fires when user leaves the page
  useEffect(() => {
    if (!recipe) return;
    const start = Date.now();
    return () => {
      const seconds = Math.round((Date.now() - start) / 1000);
      trackRecipeTimeSpent(recipe.id, recipe.name, seconds);
    };
  }, [recipe]);

  // Track scroll depth — fires at 25 / 50 / 75 / 100 %
  useEffect(() => {
    if (!recipe) return;
    const reached = new Set<number>();
    const thresholds = [25, 50, 75, 100];

    function onScroll() {
      const el = document.documentElement;
      const scrolled = el.scrollTop + window.innerHeight;
      const total = el.scrollHeight;
      const pct = Math.round((scrolled / total) * 100);

      for (const t of thresholds) {
        if (pct >= t && !reached.has(t)) {
          reached.add(t);
          trackRecipeScroll(recipe!.id, recipe!.name, t);
        }
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [recipe]);

  if (!recipe) return null;

  return (
    <div className="recipe-page">
      <RecipeDetail recipe={recipe} />
    </div>
  );
}
