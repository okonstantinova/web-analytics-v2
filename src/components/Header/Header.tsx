import { Link } from 'react-router-dom';
import { HeartOutlined } from '@ant-design/icons';
import { useFavorites } from '../../context/FavoritesContext';
import './Header.css';

export default function Header() {
  const { favorites } = useFavorites();

  return (
    <header className="header">
      <Link to="/" className="header-logo">
        Khrum Khrum
      </Link>
      <nav className="header-nav">
        <Link to="/favorites" className="header-favorites-link">
          <HeartOutlined className="header-heart-icon" />
          Избранное
          {favorites.length > 0 && (
            <span className="header-favorites-count">{favorites.length}</span>
          )}
        </Link>
      </nav>
    </header>
  );
}
