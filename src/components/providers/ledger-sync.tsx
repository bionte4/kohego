"use client";

import { useEffect } from "react";
import { startLedgerSync } from "@/lib/ledger-sync";

export function LedgerSync() {
  useEffect(() => {
    startLedgerSync();
  }, []);
  return null;
}
