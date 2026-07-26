"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useLoadScript } from "@react-google-maps/api";

const GOOGLE_MAPS_LIBRARIES: ("places")[] = ["places"];

type GoogleMapsContextValue = {
  isLoaded: boolean;
  loadError: Error | undefined;
  apiKeyMissing: boolean;
};

const GoogleMapsContext = createContext<GoogleMapsContextValue>({
  isLoaded: false,
  loadError: undefined,
  apiKeyMissing: false,
});

export function GoogleMapsProvider({ children }: { children: ReactNode }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const apiKeyMissing = apiKey.length === 0;

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  return (
    <GoogleMapsContext.Provider
      value={{ isLoaded: !apiKeyMissing && isLoaded, loadError, apiKeyMissing }}
    >
      {children}
    </GoogleMapsContext.Provider>
  );
}

export function useGoogleMaps() {
  return useContext(GoogleMapsContext);
}
