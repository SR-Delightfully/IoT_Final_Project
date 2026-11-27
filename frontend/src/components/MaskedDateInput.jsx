import { forwardRef } from "react";
import { IMaskInput } from "react-imask";
import { currentLang } from "../utils/i18n";

// Date input with fixed dashes and alsi it will be digit only .
const MaskedDateInput = forwardRef(function MaskedDateInput(
  { value, onChange, ...props },
  ref
) {
  // Placeholder letters: yyyy-mm-dd in English, aaaa-mm-jj in French
  const french = currentLang() === "fr";

  return (
    <IMaskInput
      {...props}
      inputRef={ref}
      mask="YYYY-MM-DD"
      blocks={{
        YYYY: { mask: "0000", placeholderChar: french ? "a" : "y" },
        MM: { mask: "00", placeholderChar: "m" },
        DD: { mask: "00", placeholderChar: french ? "j" : "d" },
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