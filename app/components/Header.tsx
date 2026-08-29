"use client";

import { ArrowUpRight, ChevronDown, Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

const BNCC_SUBMENU = [
  ["Educação Infantil", "/bncc/educacao-infantil"],
  ["Ensino Fundamental", "/bncc/ensino-fundamental"],
  ["Ensino Médio", "/bncc/ensino-medio"],
  ["Competências Gerais", "/bncc/competencias-gerais"],
] as const;

export function Header() {
  const pathname = usePathname();
  const isBnccExact = pathname === "/bncc";
  const isBnccSection = isBnccExact || pathname.startsWith("/bncc/");
  // Só um elemento da navegação pode estar "atual" ao mesmo tempo. Em /bncc
  // exato, o próprio link recebe aria-current="page". Em qualquer página
  // filha — inclusive quando um item do submenu bate exatamente com a URL —
  // o link pai fica sem aria-current (nunca "location": isso duplicava o
  // "atual" junto com o item exato do submenu) e recebe só a classe visual
  // is-section-active, que não afirma nada para tecnologia assistiva.
  const bnccAriaCurrent: "page" | undefined = isBnccExact ? "page" : undefined;
  const bnccSectionClassName = isBnccSection && !isBnccExact ? "is-section-active" : undefined;

  const desktopDropdownId = useId();
  const mobileNavId = useId();
  const mobileBnccPanelId = useId();

  const [desktopBnccOpen, setDesktopBnccOpen] = useState(false);
  const desktopGroupRef = useRef<HTMLDivElement>(null);
  const desktopToggleRef = useRef<HTMLButtonElement>(null);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileBnccOpen, setMobileBnccOpen] = useState(false);
  const mobileGroupRef = useRef<HTMLDivElement>(null);
  const mobileToggleRef = useRef<HTMLButtonElement>(null);

  function closeMobile(returnFocus: boolean) {
    setMobileOpen(false);
    setMobileBnccOpen(false);
    if (returnFocus) mobileToggleRef.current?.focus();
  }

  function closeDesktopBncc(returnFocus: boolean) {
    setDesktopBnccOpen(false);
    if (returnFocus) desktopToggleRef.current?.focus();
  }

  // O botão hambúrguer só abre (nunca mexe no accordion) ou fecha por completo
  // via closeMobile — antes, fechar clicando no próprio X só alternava
  // mobileOpen e deixava mobileBnccOpen preso em true, reabrindo o painel já
  // com o submenu BNCC expandido na vez seguinte.
  function toggleMobile() {
    if (mobileOpen) {
      closeMobile(false);
    } else {
      setMobileOpen(true);
    }
  }

  // Um único par de listeners cobre os dois widgets (dropdown desktop e painel
  // mobile): Escape fecha o que estiver aberto e devolve o foco ao acionador;
  // clique fora só fecha, sem mexer no foco (padrão comum de disclosure).
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (mobileOpen) { closeMobile(true); return; }
      if (desktopBnccOpen) closeDesktopBncc(true);
    }
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (mobileOpen && mobileGroupRef.current && !mobileGroupRef.current.contains(target)) closeMobile(false);
      if (desktopBnccOpen && desktopGroupRef.current && !desktopGroupRef.current.contains(target)) closeDesktopBncc(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [mobileOpen, desktopBnccOpen]);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <a className="wordmark" href="/" aria-label="Tempo Docente — início">
          <img className="wordmark-mark" src="/mark.png" alt="" width={28} height={28} />
          <span className="wordmark-name">Tempo Docente</span>
        </a>

        <nav className="desktop-nav" aria-label="Navegação principal">
          <a href="/" aria-current={pathname === "/" ? "page" : undefined}>Início</a>

          <div className="nav-item" ref={desktopGroupRef}>
            <a href="/bncc" aria-current={bnccAriaCurrent} className={bnccSectionClassName}>BNCC</a>
            <button
              type="button"
              ref={desktopToggleRef}
              className="nav-toggle"
              aria-expanded={desktopBnccOpen}
              aria-controls={desktopDropdownId}
              aria-label="Submenu de BNCC"
              onClick={() => setDesktopBnccOpen((open) => !open)}
            >
              <ChevronDown size={16} aria-hidden="true" />
            </button>
            {/* hidden (não desmontar): mantém os 4 links no HTML server-renderizado
                — verificável sem abrir o menu — e o atributo nativo já tira o
                conteúdo da árvore de acessibilidade e da ordem de tabulação
                enquanto fechado, sem precisar de JS extra para isso. */}
            <div className="nav-dropdown" id={desktopDropdownId} hidden={!desktopBnccOpen}>
              {BNCC_SUBMENU.map(([label, href]) => (
                <a key={href} href={href} aria-current={pathname === href ? "page" : undefined} onClick={() => closeDesktopBncc(false)}>
                  {label}
                </a>
              ))}
            </div>
          </div>

          <a href="/saresp" aria-current={pathname === "/saresp" ? "page" : undefined}>SARESP</a>
          <a href="/sobre" aria-current={pathname === "/sobre" ? "page" : undefined}>Sobre</a>
        </nav>

        <a className="header-cta" href="/bncc">
          Explorar BNCC <ArrowUpRight size={16} aria-hidden="true" />
        </a>

        <div className="mobile-menu" ref={mobileGroupRef}>
          <button
            type="button"
            ref={mobileToggleRef}
            className="mobile-menu-toggle"
            aria-expanded={mobileOpen}
            aria-controls={mobileNavId}
            aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
            onClick={toggleMobile}
          >
            {mobileOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>

          <nav aria-label="Navegação móvel" id={mobileNavId} hidden={!mobileOpen}>
            <a href="/" aria-current={pathname === "/" ? "page" : undefined} onClick={() => closeMobile(false)}>Início</a>

            <div className="mobile-accordion">
              <div className="mobile-accordion-row">
                <a href="/bncc" aria-current={bnccAriaCurrent} className={bnccSectionClassName} onClick={() => closeMobile(false)}>BNCC</a>
                <button
                  type="button"
                  className="mobile-accordion-trigger"
                  aria-expanded={mobileBnccOpen}
                  aria-controls={mobileBnccPanelId}
                  aria-label="Submenu de BNCC"
                  onClick={() => setMobileBnccOpen((open) => !open)}
                >
                  <ChevronDown size={18} aria-hidden="true" />
                </button>
              </div>
              <div className="mobile-accordion-panel" id={mobileBnccPanelId} hidden={!mobileBnccOpen}>
                {BNCC_SUBMENU.map(([label, href]) => (
                  <a key={href} href={href} aria-current={pathname === href ? "page" : undefined} onClick={() => closeMobile(false)}>
                    {label}
                  </a>
                ))}
              </div>
            </div>

            <a href="/saresp" aria-current={pathname === "/saresp" ? "page" : undefined} onClick={() => closeMobile(false)}>SARESP</a>
            <a href="/sobre" aria-current={pathname === "/sobre" ? "page" : undefined} onClick={() => closeMobile(false)}>Sobre</a>
            <a className="mobile-menu-cta" href="/bncc" onClick={() => closeMobile(false)}>Explorar BNCC</a>
          </nav>
        </div>
      </div>
    </header>
  );
}
