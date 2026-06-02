import MarketingFooter from "./MarketingFooter";
import MarketingNav from "./MarketingNav";

export default function LegalPageLayout({ title, lastUpdated, children }) {
  return (
    <div className="alm">
      <MarketingNav />
      <main className="alm-main alm-subpage alm-legal">
        <h1 className="alm-subpage__title">{title}</h1>
        <p className="alm-legal__updated">Last updated: {lastUpdated}</p>
        <div className="alm-legal__body">{children}</div>
      </main>
      <MarketingFooter />
    </div>
  );
}
