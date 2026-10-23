
function HumidityBar({ value }) {
  const percentage =
    value == null ? 0 : Math.max(0, Math.min(100, value));

  return (
    <div className="humidity-meter">
      <div
        className="humidity-track"
        role="progressbar"
        aria-label="Humidity"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value ?? undefined}
      >
        <div
          className="humidity-fill"
          style={{ width: `${percentage}%` }}
        />
        {value != null && (
          <span
            className="humidity-indicator"
            style={{ left: `${percentage}%` }}
          />
        )}
      </div>

      <p className="gauge-reading">
        {value ?? "--"}%
      </p>

      <div className="gauge-limits">
        <span>0%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

export default HumidityBar;
