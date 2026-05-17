import { Input } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import './SearchBar.css';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="search-bar">
      <Input
        size="large"
        placeholder="Поиск рецептов по названию или ингредиентам..."
        prefix={<SearchOutlined style={{ color: 'var(--color-text-secondary)' }} />}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        allowClear
        className="search-input"
      />
    </div>
  );
}
