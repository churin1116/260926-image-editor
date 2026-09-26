"use client";

import dynamic from "next/dynamic";

// Client-only: the tool is all browser APIs, and rendering it on the server
// would first paint the default color before the saved one loads from storage.
const Recolorer = dynamic(() => import("./Recolorer"), { ssr: false });

export function RecolorerLoader() {
  return <Recolorer />;
}
