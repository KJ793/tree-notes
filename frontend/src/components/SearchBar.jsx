import { useState } from "react";

function SearchBar({ onSearch }) {

  // << FRONTEND DEV >> //
  // Stores the text currently entered into the search bar //
  const [searchTerm, setSearchTerm] = useState("");


  function handleSearch(event) {
    event.preventDefault();

    // << FRONTEND DEV >> //
    // Sends the current search term to the parent component //

    if (!searchTerm.trim()) {
      return;
    }

    onSearch(searchTerm);
  }


  return (

    <form
      className="search-bar"
      onSubmit={handleSearch}
    >

      {/* << FRONTEND DEV >> */}
      {/* Search input controlled by React state */}

      <input
        type="text"
        value={searchTerm}
        onChange={(event) =>
          setSearchTerm(event.target.value)
        }
        placeholder="Search notes..."
      />


      {/* << SEARCH CONNECTION >> */}
      {/* Parent component decides what happens with searchTerm */}
      {/* Backend search connection can be added there later */}

      <button type="submit">
        Search
      </button>

    </form>
  );
}

export default SearchBar;