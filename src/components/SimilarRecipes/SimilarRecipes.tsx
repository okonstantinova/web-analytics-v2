import { useMemo } from 'react';
// import { useEffect, useRef, useState } from 'react';
// import { DownOutlined } from '@ant-design/icons';
import type { Recipe } from '../../types';
import { getSimilarRecipes } from '../../services/recipeService';
import RecipeCard from '../RecipeCard/RecipeCard';
import './SimilarRecipes.css';

interface SimilarRecipesProps {
  recipe: Recipe;
  limit?: number;
}

export default function SimilarRecipes({ recipe, limit = 4 }: SimilarRecipesProps) {
  const similar = useMemo(() => getSimilarRecipes(recipe, limit), [recipe, limit]);
  // const sectionRef = useRef<HTMLElement | null>(null);
  // const [hintVisible, setHintVisible] = useState(false);

  // useEffect(() => {
  //   if (similar.length === 0) return;
  //
  //   function update() {
  //     const section = sectionRef.current;
  //     if (!section) return;
  //     const rect = section.getBoundingClientRect();
  //     const sectionInView = rect.top < window.innerHeight - 80;
  //     setHintVisible(!sectionInView && window.scrollY > 400);
  //   }
  //
  //   window.addEventListener('scroll', update, { passive: true });
  //   window.addEventListener('resize', update);
  //   update();
  //
  //   return () => {
  //     window.removeEventListener('scroll', update);
  //     window.removeEventListener('resize', update);
  //   };
  // }, [similar.length, recipe.id]);

  if (similar.length === 0) return null;

  // function scrollToSection() {
  //   sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  // }

  return (
    <>
      {/* <button
        type="button"
        className={`similar-hint${hintVisible ? ' similar-hint--visible' : ''}`}
        onClick={scrollToSection}
        aria-label="Смотрите также похожие рецепты"
      >
        <span className="similar-hint-text">
          <span className="similar-hint-text-lead">Смотрите также</span>
          <span className="similar-hint-text-main">похожие рецепты</span>
        </span>
        <span className="similar-hint-arrow" aria-hidden="true">
          <DownOutlined />
        </span>
      </button> */}
      <section
        className="similar-recipes"
        aria-labelledby="similar-recipes-heading"
      >
        <header className="similar-recipes-header">
          <h2 id="similar-recipes-heading" className="similar-recipes-title">
            Похожие рецепты
          </h2>
          <p className="similar-recipes-subtitle">Возможно, вам тоже понравится</p>
        </header>
        <div className="similar-recipes-grid">
          {similar.map((r) => (
            <RecipeCard key={r.id} recipe={r} />
          ))}
        </div>
      </section>
    </>
  );
}
