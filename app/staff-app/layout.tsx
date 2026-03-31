import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./staff-app.css";

export const metadata: Metadata = {
  title: "SCM Staff App",
  description: "Standalone mobile staff operations app for SCM field teams.",
};

export default function StaffAppLayout({ children }: { children: ReactNode }) {
  return children;
}
