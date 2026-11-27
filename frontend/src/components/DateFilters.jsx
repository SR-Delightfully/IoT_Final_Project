import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import MaskedDateInput from "./MaskedDateInput";

function formatFilterDate(date) {
  if (!date) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function DateFilters({ startDate, endDate, setStartDate, setEndDate }) {
  return (
    <div className="purchase-date-filters">
      <div className="form-field">
        <label htmlFor="start-date">Start date</label>
        <DatePicker
          id="start-date"
          selected={startDate ? new Date(`${startDate}T00:00:00`) : null}
          onChange={(date) => setStartDate(formatFilterDate(date))}
          dateFormat="yyyy-MM-dd"
          customInput={<MaskedDateInput />}
          strictParsing
          showMonthDropdown
          showYearDropdown
          dropdownMode="select"
          minDate={new Date(1950, 0, 1)}
          maxDate={new Date()}
          isClearable
        />
      </div>

      <div className="form-field">
        <label htmlFor="end-date">End date</label>
        <DatePicker
          id="end-date"
          selected={endDate ? new Date(`${endDate}T00:00:00`) : null}
          onChange={(date) => setEndDate(formatFilterDate(date))}
          dateFormat="yyyy-MM-dd"
          customInput={<MaskedDateInput />}
          strictParsing
          showMonthDropdown
          showYearDropdown
          dropdownMode="select"
          minDate={
            startDate
              ? new Date(`${startDate}T00:00:00`)
              : new Date(1950, 0, 1)
          }
          maxDate={new Date()}
          isClearable
        />
      </div>
    </div>
  );
}

export default DateFilters;