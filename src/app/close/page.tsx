"use client";

import { useEffect } from "react";

export default function ClosePage() {
  useEffect(() => {
    window.close();
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-black text-white/60">
      <p>Authorization complete. This window will close automatically.</p>
    </div>
  );
}
