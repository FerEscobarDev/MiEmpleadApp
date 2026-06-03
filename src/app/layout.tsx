import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MiEmpleadApp",
  description:
    "Control de salario, días trabajados, pagos adicionales, menús y tareas de una empleada doméstica en Colombia.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-CO">
      <body>{children}</body>
    </html>
  );
}
