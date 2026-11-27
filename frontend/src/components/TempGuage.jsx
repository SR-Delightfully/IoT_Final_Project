import { useI18n } from "../utils/i18n";

function TempGauge({ value, min = 0, max = 10 }) {
  const { t } = useI18n();
  const percentage =
    value == null || max <= min
      ? 0
      : Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  const angle = -90 + percentage * 1.8;

  return (
    <div className="temperature-gauge">
      <div
        className="temperature-dial"
        style={{ "--gauge-angle": `${angle}deg` }}
        role="img"
        aria-label={t("Temp: {0} °C", { 0: value ?? "unavailable" })}
      >
        <div className="temperature-needle" />
        <div className="temperature-center" />
      </div>

      <p className="gauge-reading">
        {value ?? "--"} °C
      </p>

      <div className="gauge-limits">
        <span>{min}°</span>
        <span>{max}°</span>
      </div>
    </div>
  );
}

export default TempGauge;
