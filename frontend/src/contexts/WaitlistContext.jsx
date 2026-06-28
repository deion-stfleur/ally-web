import { createContext, useCallback, useContext, useMemo, useState } from "react";
import WaitlistModal from "../components/WaitlistModal";

const WaitlistContext = createContext(null);

export function WaitlistProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState("site");

  const openWaitlist = useCallback((nextSource = "site") => {
    setSource(nextSource || "site");
    setOpen(true);
  }, []);

  const closeWaitlist = useCallback(() => {
    setOpen(false);
  }, []);

  const value = useMemo(
    () => ({ openWaitlist, closeWaitlist, isOpen: open }),
    [openWaitlist, closeWaitlist, open]
  );

  return (
    <WaitlistContext.Provider value={value}>
      {children}
      <WaitlistModal open={open} onClose={closeWaitlist} source={source} />
    </WaitlistContext.Provider>
  );
}

export function useWaitlist() {
  const ctx = useContext(WaitlistContext);
  if (!ctx) {
    throw new Error("useWaitlist must be used within WaitlistProvider");
  }
  return ctx;
}
