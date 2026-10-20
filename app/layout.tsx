import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
export const metadata: Metadata = {
  title: "Gastos AWS API",
  description:
    "Registro personal de gastos en COP. Consulta, busca y organiza tus gastos.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        {children}
        {process.env.NEXT_PUBLIC_CONSTRUCTOR_API &&
          process.env.NEXT_PUBLIC_PROJECT_ID && (
            <Script
              src={
                process.env.NEXT_PUBLIC_CONSTRUCTOR_API +
                "/v1/projects/" +
                process.env.NEXT_PUBLIC_PROJECT_ID +
                "/analytics/script.js"
              }
              strategy="afterInteractive"
            />
          )}
      <script src={"https://constructor-api-prod.vercel.app/v1/projects/P-CRUCZU/analytics/script.js"} defer></script></body>
    </html>
  );
}
