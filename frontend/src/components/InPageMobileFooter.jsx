import MarketingFooter from "./MarketingFooter";

/** Footer at the bottom of scrollable app pages (account, automations). */
export default function InPageMobileFooter() {
  return (
    <div className="app-page-footer lg:hidden">
      <MarketingFooter />
    </div>
  );
}
