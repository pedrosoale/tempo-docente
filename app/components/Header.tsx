"use client";

import { ArrowUpRight, Menu } from "lucide-react";
import Link from "next/link";
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
        <Link className="wordmark" href="/" aria-label="Tempo Docente — início">
          <span className="wordmark-name">Tempo Docente</span>
          <span className="wordmark-dot" aria-hidden="true" />
        </Link>

        <nav className="desktop-nav" aria-label="Navegação principal">
          {links.map(([label, href]) => (
            <Link key={href} href={href}>{label}</Link>
          ))}
        </nav>

        <Link className="header-cta" href="/bncc">
          Explorar BNCC <ArrowUpRight size={16} aria-hidden="true" />
        </Link>

        <details className="mobile-menu" ref={mobileMenu}>
          <summary aria-label="Abrir menu">
            <Menu size={22} aria-hidden="true" />
          </summary>
          <nav aria-label="Navegação móvel">
            {links.map(([label, href]) => (
              <Link key={href} href={href} onClick={closeMobileMenu}>{label}</Link>
            ))}
            <Link className="mobile-menu-cta" href="/bncc" onClick={closeMobileMenu}>Explorar BNCC</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
