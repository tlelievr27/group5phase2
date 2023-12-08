import React, { ChangeEvent, useState } from 'react';
import { FaSearch } from 'react-icons/fa';

interface SearchBarProps {
  onSearch: (searchTerm: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isLabelVisible, setLabelVisible] = useState(false);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newSearchTerm = event.target.value;
    setSearchTerm(newSearchTerm);
  };

  const handleSearchButtonClick = () => {
    onSearch(searchTerm);
  };

  const handleSearchButtonKeydown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter') {
      onSearch(searchTerm);
    }
  };

  return (
    <div className="relative flex items-center space-x-4">
      <label htmlFor="searchInput" className="sr-only">Search for packages</label>
      <input
        id="searchInput"
        type="text"
        placeholder="Search for packages"
        className="border border-gray-300 px-4 py-3 rounded-md focus:outline-none focus:border-blue-500 focus:ring focus:ring-blue-300 w-full"
        onChange={handleInputChange}
        aria-labelledby="searchInput"
      />
      <button
        type="button"
        aria-label="Search"
        aria-haspopup="true"
        role="search"
        className="bg-blue-500 text-white px-3 py-3 rounded-md hover:bg-blue-600 focus:outline-none focus:shadow-outline-blue focus:ring focus:ring-blue-300 flex items-center relative"
        onClick={handleSearchButtonClick}
        onMouseEnter={() => setLabelVisible(true)}
        onMouseLeave={() => setLabelVisible(false)}
        onKeyDown={handleSearchButtonKeydown}
      >
        <FaSearch className="flex item-center" />
        {isLabelVisible && (
          <span className="absolute bg-white text-gray-600 p-2 opacity-100 transition-opacity duration-300 bottom-full left-1/2 transform -translate-x-1/2">
            Press Enter to Search
          </span>
        )}
      </button>
    </div>
  );
};

export default SearchBar;