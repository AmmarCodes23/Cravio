"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Combobox,
  ComboboxInput,
  ComboboxPopover,
  ComboboxList,
  ComboboxOption,
} from "@reach/combobox";
import { useLocation } from "../context/LocationContext";
import "@reach/combobox/styles.css";
import { useSession } from "next-auth/react";
import { useUserInfo } from "../context/UserInfoContext";
import type {
  AddressDisplayProps,
  LocationSelectorProps,
  PlacesAutoCompleteProps,
} from "../Data/database";
import { newPlacesSessionToken } from "@/lib/geo";
import { Locate } from "lucide-react";

const DeliveryMap = dynamic(() => import("./DeliveryMap"), { ssr: false });

const MIN_QUERY = 3;
const DEBOUNCE_MS = 450;

type Suggestion = { placeId: string; description: string; lat?: number; lng?: number };

async function reverseGeocode(lat: number, lng: number) {
  const res = await fetch(`/api/geo/reverse?lat=${lat}&lng=${lng}`);
  if (!res.ok) throw new Error("Reverse geocode failed");
  const data = (await res.json()) as { address?: string };
  return data.address || "Address not found";
}

export default function LocationSelector({ allowChange = false }: LocationSelectorProps = {}) {
  const center = useMemo(() => ({ lat: 24.8607, lng: 67.0011 }), []);
  const [selected, setSelected] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const { selectedAddress, setSelectedAddress, setCoordinates } = useLocation();
  const { setCity, setBuilding, setStreet } = useUserInfo();
  const { data: session } = useSession();
  const [isMobile, setIsMobile] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);

    const fetchSavedLocation = async () => {
      const userId =
        typeof session?.user === "object" && session?.user !== null && "id" in session.user
          ? (session.user as { id?: string }).id
          : undefined;
      if (!userId) return;

      try {
        const res = await fetch(`/api/location?userId=${userId}`);
        if (!res.ok) return;

        const locationData = await res.json();
        if (!locationData.placesauto) return;

        if (locationData?.placesauto) {
          setAddress(locationData.placesauto);
          setSelectedAddress(locationData.placesauto);
        }
        if (locationData?.city) setCity(locationData.city);
        if (locationData?.building) setBuilding(locationData.building);
        if (locationData?.street) setStreet(locationData.street);
        if (
          typeof locationData?.latitude === "number" &&
          typeof locationData?.longitude === "number"
        ) {
          setSelected({ lat: locationData.latitude, lng: locationData.longitude });
          setCoordinates({ lat: locationData.latitude, lng: locationData.longitude });
        }
      } catch (err) {
        console.error("Error fetching location:", err);
      }
    };

    fetchSavedLocation();
    return () => window.removeEventListener("resize", onResize);
  }, [session, setSelectedAddress, setCity, setBuilding, setStreet, setCoordinates]);

  const applyPin = async (latLng: { lat: number; lng: number }) => {
    setSelected(latLng);
    setCoordinates(latLng);
    try {
      const fullAddress = await reverseGeocode(latLng.lat, latLng.lng);
      setAddress(fullAddress);
      setSelectedAddress(fullAddress);
    } catch (error) {
      console.error("Error during reverse geocoding:", error);
      setAddress("Error fetching address");
    }
  };

  const showSearch = allowChange || !selectedAddress;

  return (
    <div className="flex flex-col gap-2 w-full ">
      {showSearch && (
        <div>
          <PlacesAutoComplete
            setSelected={setSelected}
            setMapToOpen={setMapOpen}
            setAddress={setAddress}
          />
          <button
            type="button"
            onClick={async () => {
              if (!navigator.geolocation) {
                alert("Geolocation not supported");
                return;
              }
              setLocating(true);
              navigator.geolocation.getCurrentPosition(
                async (pos) => {
                  const latLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                  setMapOpen(true);
                  try {
                    await applyPin(latLng);
                  } finally {
                    setLocating(false);
                  }
                },
                (err) => {
                  console.error("Geolocation error", err);
                  setLocating(false);
                  alert("Unable to fetch current location");
                },
                { enableHighAccuracy: true, timeout: 10000 }
              );
            }}
            className="mt-2 inline-flex items-center gap-2 justify-center w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            disabled={locating}
          >
            <Locate className="text-primary" />
            {locating ? "Locating..." : "Use current location"}
          </button>
        </div>
      )}
      <AddressDisplay address={selectedAddress || address} />
      {mapOpen ? (
        <button
          className="px-5 cursor-pointer py-2 hover:bg-secondary hover:text-accents w-full font-sifonn rounded-md bg-primary text-accents text-xs md:text-lg"
          onClick={() => {
            setSelectedAddress(address ?? "");
            if (selected) setCoordinates(selected);
            setMapOpen(false);
          }}
        >
          Confirm Delivery Address
        </button>
      ) : null}

      {mapOpen ? (
        <DeliveryMap
          selected={selected ?? center}
          onPick={applyPin}
          height={isMobile ? 320 : 400}
        />
      ) : null}
    </div>
  );
}

function PlacesAutoComplete({
  setSelected,
  setAddress,
  setMapToOpen,
}: PlacesAutoCompleteProps) {
  const { setCoordinates } = useLocation();
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState(newPlacesSessionToken);
  const cache = useRef(new Map<string, Suggestion[]>());
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = value.trim();
    if (q.length < MIN_QUERY) {
      setSuggestions([]);
      return;
    }
    if (!focused) return;

    const cached = cache.current.get(q.toLowerCase());
    if (cached) {
      setSuggestions(cached);
      return;
    }

    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(`/api/geo/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          setSearchError("Address search is unavailable. Try Use current location or drop a pin on the map.");
          return;
        }
        const data = (await res.json()) as { suggestions?: Suggestion[] };
        const next = data.suggestions ?? [];
        cache.current.set(q.toLowerCase(), next);
        setSuggestions(next);
        setSearchError(null);
      } catch (err) {
        if ((err as { name?: string }).name !== "AbortError") {
          console.error("Autocomplete failed", err);
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [value, focused, sessionToken]);

  const handleSelect = async (description: string) => {
    const match = suggestions.find((s) => s.description === description);
    setValue(description);
    setSuggestions([]);
    setAddress(description);
    setMapToOpen(true);
    if (!match) return;
    if (typeof match.lat === "number" && typeof match.lng === "number") {
      const latLng = { lat: match.lat, lng: match.lng };
      setSelected(latLng);
      setCoordinates(latLng);
      return;
    }
    try {
      const res = await fetch(
        `/api/places/geocode?placeId=${encodeURIComponent(match.placeId)}&address=${encodeURIComponent(description)}&sessionToken=${encodeURIComponent(sessionToken)}`
      );
      if (!res.ok) return;
      const data = (await res.json()) as { lat?: number; lng?: number; address?: string };
      if (typeof data.lat === "number" && typeof data.lng === "number") {
        const latLng = { lat: data.lat, lng: data.lng };
        setSelected(latLng);
        setCoordinates(latLng);
        if (data.address) setAddress(data.address);
      }
    } catch (err) {
      console.error("Geocode failed", err);
    } finally {
      setSessionToken(newPlacesSessionToken());
    }
  };

  return (
    <Combobox onSelect={handleSelect}>
      <ComboboxInput
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Search an Address"
        className="w-full"
      />
      <ComboboxPopover className="!z-[10020] bg-white shadow-lg">
        <ComboboxList>
          {suggestions.map((s) => (
            <ComboboxOption key={s.placeId} value={s.description} />
          ))}
        </ComboboxList>
      </ComboboxPopover>
      {searchError ? <p className="mt-1 text-xs text-amber-700">{searchError}</p> : null}
    </Combobox>
  );
}

const AddressDisplay = ({ address }: AddressDisplayProps) => {
  if (!address) return null;

  return (
    <div className="p-1 md:p-3 text-sm">
      <p className="font-semibold text-blue-800">Selected Address:</p>
      <p className="text-blue-700">{address}</p>
    </div>
  );
};
