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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@100..900&display=swap" rel="stylesheet" />
      </head>
      <body>
        <TextCustomizationProvider>{children}</TextCustomizationProvider>
      </body>
    </html>
  );
}
