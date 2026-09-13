"use client";

import { useState } from "react";

export interface ComboboxOption<T> {
  key: string;
  label: string;
  sublabel?: string;
  value: T;
}

interface ComboboxProps<T> {
  id: string;
  query: string;
  onQueryChange: (value: string) => void;
  onSelect: (value: T) => void;
  options: ComboboxOption<T>[];
  placeholder?: string;
  ariaLabel: string;
  limit?: number;
  disabled?: boolean;
}

// Mesmo padrão WAI-ARIA APG "combobox with listbox popup" de app/saresp/components/SchoolCombobox.tsx
// (teclado ponta a ponta, só as opções visíveis vão para o DOM) — reescrito aqui, genérico sobre T,
// em vez de importar o componente do SARESP: o SAEB busca por município E por escola com formatos de
// opção diferentes, e alterar o componente do SARESP para generalizá-lo arriscaria uma regressão ali
// por causa de uma necessidade de outra área do site.
export default function Combobox<T>({ id, query, onQueryChange, onSelect, options, placeholder, ariaLabel, limit = 20, disabled }: ComboboxProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listboxId = `${id}-listbox`;

  const visiveis = options.slice(0, limit);
  const ocultas = options.length - visiveis.length;
  const showListbox = isOpen && visiveis.length > 0;
  const activeOption = activeIndex >= 0 ? visiveis[activeIndex] : undefined;

  function selecionar(opcao: ComboboxOption<T>) {
    onSelect(opcao.value);
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
      if (!visiveis.length) return;
      setIsOpen(true);
      setActiveIndex((current) => (current + 1) % visiveis.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!visiveis.length) return;
      setIsOpen(true);
      setActiveIndex((current) => (current <= 0 ? visiveis.length - 1 : current - 1));
    } else if (event.key === "Enter") {
      if (isOpen && activeOption) {
        event.preventDefault();
        selecionar(activeOption);
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
    <div className="saeb-combobox">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={showListbox}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeOption ? `${listboxId}-${activeOption.key}` : undefined}
        autoComplete="off"
        disabled={disabled}
        value={query}
        placeholder={placeholder}
        onChange={(event) => handleQueryChange(event.target.value)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onKeyDown={handleKeyDown}
      />
      {showListbox && (
        <div className="saeb-combobox-listbox">
          <ul role="listbox" id={listboxId}>
            {visiveis.map((opcao, indice) => (
              <li
                key={opcao.key}
                id={`${listboxId}-${opcao.key}`}
                role="option"
                aria-selected={indice === activeIndex}
                className={indice === activeIndex ? "saeb-combobox-option is-active" : "saeb-combobox-option"}
                // onMouseDown (não onClick) + preventDefault: dispara antes do blur do input, então a
                // seleção é tratada antes que o foco saia e feche a lista.
                onMouseDown={(event) => {
                  event.preventDefault();
                  selecionar(opcao);
                }}
              >
                <span>{opcao.label}</span>
                {opcao.sublabel && <small>{opcao.sublabel}</small>}
              </li>
            ))}
          </ul>
          {ocultas > 0 && <p className="saeb-combobox-note">Mostrando {visiveis.length} de {options.length} — refine a busca para ver outras.</p>}
        </div>
      )}
    </div>
  );
}
