function Display() {
  return (
    <main className="fridge-page">

      {/* Fridge 1 */}
      <div className="fridge-card">
        <div className="fridge-card-body">

          <h1 className="fridge-title">
            Refrigerator 1
          </h1>

          <div className="gauge-container">

            <div className="gauge">
              <h2 className="fridge-subtitle">
                Temperature
              </h2>

              <div>
                Temperature Gauge Here
              </div>

              <p className="gauge-reading">
                Current temperature here
              </p>
            </div>

            <div className="gauge">
              <h2 className="fridge-subtitle">
                Humidity
              </h2>

              <div>
                Humidity Gauge Here
              </div>

              <p className="gauge-reading">
                Current humidity here
              </p>
            </div>

          </div>

          <form id="customer-fridge" action="">
            <div className="form-grid">

              <div className="form-field form-field-full">
                <label htmlFor="min-temp-input" className="form-label">
                  Minimum temperature (℃)
                </label>

                <input
                  type="number"
                  name="min-temp"
                  id="min-temp-input"
                  required
                />
              </div>

              <input
                type="submit"
                name="fridge"
                id="fridge-btn"
                value="Save changes"
              />

            </div>
          </form>

          <div className="fridge-footer">
            <h4 className="fan-status">
              Fan is: ON/OFF
            </h4>
          </div>

        </div>
      </div>


      {/* Fridge 2 */}
      <div className="fridge-card">
        <div className="fridge-card-body">

          <h1 className="fridge-title">
            Refrigerator 2
          </h1>

          <div className="gauge-container">

            <div className="gauge">
              <h2 className="fridge-subtitle">
                Temperature
              </h2>

              <div className="gauge-placeholder">
                Temperature Gauge Here
              </div>

              <p className="gauge-reading">
                Current temperature here
              </p>
            </div>

            <div className="gauge">
              <h2 className="fridge-subtitle">
                Humidity
              </h2>

              <div className="gauge-placeholder">
                Humidity Gauge Here
              </div>

              <p className="gauge-reading">
                Current humidity here
              </p>
            </div>

          </div>

          <form id="customer-fridge" action="">
            <div className="form-grid">

              <div className="form-field form-field-full">
                <label htmlFor="min-temp-input" className="form-label">
                  Minimum temperature (℃)
                </label>

                <input
                  type="number"
                  name="min-temp"
                  id="min-temp-input"
                  required
                />
              </div>

              <input
                type="submit"
                name="fridge"
                id="fridge-btn"
                value="Save changes"
              />

            </div>
          </form>

          <div className="fridge-footer">
            <h4 className="fan-status">
              Fan is: ON/OFF
            </h4>
          </div>

        </div>
      </div>

    </main>
  );
}

export default Display;