import type { Metadata } from "next";
import ConvexProvider from "@/components/ConvexProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Workflow Canvas",
  description: "Collaborative workflow design tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ConvexProvider>{children}</ConvexProvider>
      </body>
    </html>
  );
}
