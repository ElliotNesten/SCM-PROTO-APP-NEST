import type { Metadata } from "next";
import type { ReactNode } from "react";

import { TextCustomizationProvider } from "@/components/text-customization-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SCM Platform Prototype",
    template: "%s | SCM Platform",
  },
  description: "Next.js scaffold based on the SCM clickable prototype.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
{/* San Francisco Pro is the native system font on Apple devices — loaded via -apple-system in CSS */}
      </head>
      <body>
        <TextCustomizationProvider>{children}</TextCustomizationProvider>
      </body>
    </html>
  );
}
