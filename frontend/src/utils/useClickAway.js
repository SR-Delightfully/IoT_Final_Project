import { useEffect } from "react";

// Close a dropdown when the user clicks outside it or presses Escape.
export default function useClickAway(ref, onAway) {
  useEffect(() => {
    function handleClick(event) {
      if (ref.current && !ref.current.contains(event.target)) onAway();
    }

    function handleKey(event) {
      if (event.key === "Escape") onAway();
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [ref, onAway]);
}
