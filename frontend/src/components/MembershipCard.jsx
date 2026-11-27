import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { useI18n } from "../utils/i18n";

// Membership card shown on the account page. The barcode is the customer's
// 12-digit UPC-A code, which can be scanned at the self-checkout.
function MembershipCard({ code, name, tier, points }) {
  const { t } = useI18n();
  const barcodeRef = useRef(null);

  useEffect(() => {
    if (!barcodeRef.current || !code) return;
    try {
      JsBarcode(barcodeRef.current, code, {
        format: "UPC",
        width: 2,
        height: 60,
        fontSize: 16,
        margin: 8,
        background: "#ffffff",
        lineColor: "#000000",
      });
    } catch {
      barcodeRef.current.innerHTML = "";
    }
  }, [code]);

  return (
    <div className="membership-card">
      <div className="membership-card-top">
        <span className="membership-card-store">{t("SMART TCG STORE")}</span>
        <span className="membership-card-tier">{tier}</span>
      </div>
      <div className="membership-card-holder">
        <span className="membership-card-label">{t("MEMBER")}</span>
        <b>{name}</b>
      </div>
      <div className="membership-card-points">
        <span className="membership-card-label">{t("POINTS")}</span>
        <b>{points.toLocaleString()}</b>
      </div>
      <div className="membership-card-barcode">
        <svg ref={barcodeRef} role="img" aria-label={t("Membership card barcode {0}", { 0: code })} />
      </div>
    </div>
  );
}

export default MembershipCard;
