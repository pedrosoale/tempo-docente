"use client";

import { useMemo, useState } from "react";
import { formatSchoolLabel, matchSchoolIndex, normalizeSearch, SCHOOL_MATCH_LIMIT } from "@/lib/saresp/analysis";
import type { SearchableIdentity } from "@/lib/saresp/types";

interface SchoolComboboxProps {
  id: string;
  query: string;
  onQueryChange: (value: string) => void;
  onSelect: (entry: SearchableIdentity) => void;
  index: SearchableIdentity[];
  placeholder?: string;
}

// WAI-ARIA APG "combobox with listbox popup" pattern — replaces the old native <datalist>, which
// always renders one <option> per school (~9.760 of them) into the DOM regardless of the typed
// query; the browser only filters that list visually, so there's no way to cap what gets rendered.
// This version renders only the top SCHOOL_MATCH_LIMIT matches, keyboard-navigable end to end.
export default function SchoolCombobox({ id, query, onQueryChange, onSelect, index, placeholder }: SchoolComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listboxId = `${id}-listbox`;

  const allMatches = useMemo(() => {
    const normalized = normalizeSearch(query);
    return normalized ? matchSchoolIndex(index, normalized) : [];
  }, [index, query]);
  const matches = useMemo(() => allMatches.slice(0, SCHOOL_MATCH_LIMIT), [allMatches]);
  const hiddenMatchCount = allMatches.length - matches.length;

  const showListbox = isOpen && matches.length > 0;
  const activeEntry = activeIndex >= 0 ? matches[activeIndex] : undefined;

  function selectEntry(entry: SearchableIdentity) {
    onSelect(entry);
    setIsOpen(false);
    setActiveIndex(-1);
  }

  function handleQueryChange(value: string) {
    onQueryChange(value);
    setIsOpen(true);
    setActiveIndex(-1);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!matches.length) return;
      setIsOpen(true);
      setActiveIndex((current) => (current + 1) % matches.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!matches.length) return;
      setIsOpen(true);
      setActiveIndex((current) => (current <= 0 ? matches.length - 1 : current - 1));
    } else if (event.key === "Enter") {
      if (isOpen && activeEntry) {
        event.preventDefault();
        selectEntry(activeEntry);
      }
    } else if (event.key === "Escape") {
      if (isOpen) {
        event.preventDefault();
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }
  }

  return (
    <div className="combobox">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={showListbox}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeEntry ? `${listboxId}-${activeEntry.codesc}` : undefined}
        autoComplete="off"
        value={query}
        placeholder={placeholder}
        onChange={(event) => handleQueryChange(event.target.value)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onKeyDown={handleKeyDown}
      />
      {showListbox && (
        <div className="combobox-listbox">
          <ul role="listbox" id={listboxId}>
            {matches.map((entry, matchIndex) => (
              <li
                key={entry.codesc}
                id={`${listboxId}-${entry.codesc}`}
                role="option"
                aria-selected={matchIndex === activeIndex}
                className={matchIndex === activeIndex ? "combobox-option is-active" : "combobox-option"}
                // onMouseDown (not onClick) + preventDefault: fires before the input's blur, so the
                // selection is handled before focus would otherwise leave the input and close the list.
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectEntry(entry);
                }}
              >
                {formatSchoolLabel(entry)}
              </li>
            ))}
          </ul>
          {/* Outside the listbox (not an <li role="option">): a listbox's children should only ever
              be options, so this auxiliary note is a sibling, not part of the ARIA list semantics. */}
          {hiddenMatchCount > 0 && (
            <p className="combobox-note">Mostrando {SCHOOL_MATCH_LIMIT} de {allMatches.length} — refine a busca para ver outras escolas.</p>
          )}
        </div>
      )}
    </div>
  );
}
