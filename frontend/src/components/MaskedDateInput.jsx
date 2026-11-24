import { forwardRef } from "react";
import { IMaskInput } from "react-imask";

// Date input with fixed dashes and alsi it will be digit only .
const MaskedDateInput = forwardRef(function MaskedDateInput(
  { value, onChange, ...props },
  ref
) {
  return (
    <IMaskInput
      {...props}
      inputRef={ref}
      mask="YYYY-MM-DD"
      blocks={{
        YYYY: { mask: "0000", placeholderChar: "y" },
        MM: { mask: "00", placeholderChar: "m" },
        DD: { mask: "00", placeholderChar: "d" },
      }}
      lazy={false}
      placeholderChar="_"
      value={value || ""}
      onAccept={(maskedValue, mask, event) => {
        if (event) {
          onChange(event);
        }
      }}
    />
  );
});
export default MaskedDateInput;