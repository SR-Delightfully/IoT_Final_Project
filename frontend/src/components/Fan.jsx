
function Fan({ status, onToggle }) {
  const isOn = String(status ?? "OFF").toUpperCase() === "ON";

  return (
    <div className={`fan-indicator ${isOn ? "is-on" : "is-off"}`}>
      <div className="fan-ceiling-mount" aria-hidden="true">
        <span className="fan-mount-bracket" />
        <span className="fan-mount-stem" />

        <div className="fan">
          <svg
            className={`fan-icon ${isOn ? "fan-spinning" : ""}`}
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <g
              className="fan-rotor"
              fill="var(--gold-6)"
              stroke="var(--gold-7)"
              strokeWidth="0.35"
            >
              <path d="M12 10.5C10.2 7.3 8.7 4.7 11.3 2.4C13.1.8 16.3 2.5 15.1 5.6L13.3 10.8Z" />
              <path d="M13.5 12C16.7 10.2 19.3 8.7 21.6 11.3C23.2 13.1 21.5 16.3 18.4 15.1L13.2 13.3Z" />
              <path d="M12 13.5C13.8 16.7 15.3 19.3 12.7 21.6C10.9 23.2 7.7 21.5 8.9 18.4L10.7 13.2Z" />
              <path d="M10.5 12C7.3 13.8 4.7 15.3 2.4 12.7C.8 10.9 2.5 7.7 5.6 8.9L10.8 10.7Z" />
              <circle cx="12" cy="12" r="1.5" />
            </g>
          </svg>
        </div>
      </div>

      <div className="fan-content">
        <div className="fan-details">

          <span className="fan-state" aria-live="polite">
            <span className="fan-status-dot" />
            {isOn ? "FAN ACTIVE" : "FAN STANDBY"}
          </span>


        </div>
                  <button
            type="button"
            className="fan-toggle"
            onClick={onToggle}
            aria-pressed={isOn}
          >
            {isOn ? "POWER OFF" : "POWER ON"}
          </button>
      </div>
    </div>
  );
}

export default Fan;
