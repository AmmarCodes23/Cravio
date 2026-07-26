import type { Metadata } from "next";
import "./globals.css";
import localFont from "next/font/local";
import Provider from "./context/SessionProvider";
import LayoutSwitcher from "./components/LayoutSwitcher";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${sifonnFont.variable} ${brasikaFont.variable}`}>
        <Provider>
          <LayoutSwitcher>{children}</LayoutSwitcher>
        </Provider>
      </body>
    </html>
  );
}