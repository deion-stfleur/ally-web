import { useEffect } from "react";
import MarketingFooter from "./MarketingFooter";
import MarketingNav from "./MarketingNav";

export default function LegalPageLayout({ title, lastUpdated, description, children }) {
  useEffect(() => {
    document.title = `${title} | yourfriendally`;
    let meta = document.querySelector('meta[name="description"]');
    if (description) {
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", "description");
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", description);
    }
    return () => {
      document.title = "yourfriendally";
    };
  }, [title, description]);

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
