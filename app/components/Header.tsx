"use client";

import { ArrowUpRight, Menu } from "lucide-react";
import { useRef } from "react";

const links = [
  ["BNCC", "/bncc"],
  ["Avaliações", "/#avaliacoes"],
  ["Dados educacionais", "/#dados"],
  ["Ferramentas", "/#ferramentas"],
  ["Sobre", "/#sobre"],
] as const;

export function Header() {
  const mobileMenu = useRef<HTMLDetailsElement>(null);
  const closeMobileMenu = () => mobileMenu.current?.removeAttribute("open");

  return (
    <header className="site-header">
      <div className="container header-inner">
        <a className="wordmark" href="/" aria-label="Tempo Docente — início">
          <img className="wordmark-mark" src="/mark.png" alt="" width={28} height={28} />
          <span className="wordmark-name">Tempo Docente</span>
        </a>

        <nav className="desktop-nav" aria-label="Navegação principal">
          {links.map(([label, href]) => (
            <a key={href} href={href}>{label}</a>
          ))}
        </nav>

        <a className="header-cta" href="/bncc">
          Explorar BNCC <ArrowUpRight size={16} aria-hidden="true" />
        </a>

        <details className="mobile-menu" ref={mobileMenu}>
          <summary aria-label="Abrir menu">
            <Menu size={22} aria-hidden="true" />
          </summary>
          <nav aria-label="Navegação móvel">
            {links.map(([label, href]) => (
              <a key={href} href={href} onClick={closeMobileMenu}>{label}</a>
            ))}
            <a className="mobile-menu-cta" href="/bncc" onClick={closeMobileMenu}>Explorar BNCC</a>
          </nav>
        </details>
      </div>
    </header>
  );
}
