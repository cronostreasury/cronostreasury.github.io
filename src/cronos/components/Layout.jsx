import LiveBackground from "./LiveBackground.jsx";
import Nav from "./Nav.jsx";

export default function Layout({ active, title, subtitle, headExtra, children }) {
  return (
    <div className="cronos-page">
      <LiveBackground />
      <Nav active={active} />
      <header className="cronos-pagehead">
        <div className="cronos-pagehead-inner">
          <h1>{title}</h1>
          {subtitle && <p className="cronos-subtitle">{subtitle}</p>}
          {headExtra}
        </div>
      </header>
      <main className="cronos-main">{children}</main>
      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="cronos-footer">
      <p>
        Data:{" "}
        <a href="https://defillama.com/chain/Cronos" target="_blank" rel="noopener noreferrer">
          DeFiLlama
        </a>{" "}
        public API. Figures shown are fetched live in your browser on every page load.
      </p>
    </footer>
  );
}
