import type { Metadata } from "next";
import "./globals.css";
import localFont from "next/font/local";
import Provider from "./context/SessionProvider";
import LayoutSwitcher from "./components/LayoutSwitcher";
import { getCategories, getCompanies } from "@/lib/catalog";

export const metadata: Metadata = {
  icons: {
    icon: "/images/Cravio_Logo.png",
    shortcut: "/images/Cravio_Logo.png",
    apple: "/images/Cravio_Logo.png",
  },
};

const sifonnFont = localFont({
  src: "./fonts/Sifonn-Pro.ttf",
  variable: "--font-sifonn",
});

const brasikaFont = localFont({
  src: "./fonts/brasika-display-trial.otf",
  variable: "--font-brasika",
});
const dansonFont = localFont({
  src: "./fonts/DANSON-BOLD.otf",
  variable: "--font-danson",
});

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Cached (Data Cache, tag "catalog"); seeds the client providers so every
  // storefront page skips the /api/category + /api/company fetches on mount.
  const [initialCategories, initialCompanies] = await Promise.all([
    getCategories().catch(() => null),
    getCompanies().catch(() => null),
  ]);

  return (
    <html lang="en">
      <body className={`${sifonnFont.variable} ${brasikaFont.variable}`}>
        <Provider>
          <LayoutSwitcher
            initialCategories={initialCategories}
            initialCompanies={initialCompanies}
          >
            {children}
          </LayoutSwitcher>
        </Provider>
      </body>
    </html>
  );
}