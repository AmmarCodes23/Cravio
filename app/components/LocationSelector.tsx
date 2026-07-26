"use client"
import { useEffect, useMemo, useState } from "react";
import { GoogleMap, Marker } from "@react-google-maps/api"
import usePlacesAutocomplete, {getGeocode, getLatLng} from "use-places-autocomplete";
import {Combobox, ComboboxInput, ComboboxPopover, ComboboxList, ComboboxOption} from "@reach/combobox"
import { useLocation } from "../context/LocationContext";
import { useGoogleMaps } from "../context/GoogleMapsProvider";
import "@reach/combobox/styles.css"
import { useSession } from "next-auth/react";
import { useUserInfo } from "../context/UserInfoContext";
import Loading from "./Loading";
import type {
  AddressDisplayProps,
  LocationSelectorProps,
  PlacesAutoCompleteProps,
} from "../Data/database";
import { AlertCircle, Locate } from "lucide-react";

const KARACHI_BOUNDS = {
  // Use 'north', 'south', 'east', 'west' keys at the top level
  north: 25.15,  // Northeast latitude
  south: 24.70,  // Southwest latitude
  east: 67.25,   // Northeast longitude
  west: 66.85,   // Southwest longitude
};


function GoogleMapsError({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1">{message}</p>
        </div>
      </div>
    </div>
  );
}

export default function LocationSelector({ allowChange = false }: LocationSelectorProps = {}){
  const { isLoaded, loadError, apiKeyMissing } = useGoogleMaps();

  if (apiKeyMissing) {
    return (
      <GoogleMapsError
        title="Google Maps API key missing"
        message="Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local and restart the dev server."
      />
    );
  }

  if (loadError) {
    return (
      <GoogleMapsError
        title="Google Maps failed to load"
        message="Enable billing on your Google Cloud project and turn on Maps JavaScript API, Places API, and Geocoding API for this key."
      />
    );
  }

  if (!isLoaded) return <Loading />;

  return <Map allowChange={allowChange} />;
}

function Map({ allowChange = false }: LocationSelectorProps = {}) {
  // Use a stable center point (Karachi)
  const center = useMemo(() => ({ lat: 24.8607, lng: 67.0011 }), []);
  const [selected, setSelected] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [mapOpen,setMapOpen] = useState<boolean>(false);
  const {selectedAddress, setSelectedAddress, setCoordinates} = useLocation();
  const {setCity,setBuilding,setStreet} = useUserInfo();
  const {data:session} = useSession();
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
        if(!locationData.placesauto){
          return
        }

      if (locationData?.placesauto) {
        setAddress(locationData.placesauto);
        setSelectedAddress(locationData.placesauto);
      } else {
        console.warn("placesauto missing in location data");
      }

      if (locationData?.city) {
        setCity(locationData.city);
      } else {
        console.warn("city missing in location data");
      }

      if (locationData?.building) {
        setBuilding(locationData.building);
      } else {
        console.warn("building missing in location data");
      }

      if (locationData?.street) {
        setStreet(locationData.street);
      } else {
        console.warn("street missing in location data");
      }

      } catch (err) {
        console.error("Error fetching location:", err);
      }
    };

    fetchSavedLocation();
    return () => window.removeEventListener("resize", onResize);
  }, [session, setSelectedAddress, setCity, setBuilding, setStreet]);
  const onMapClick = async (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const latLng = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      setSelected(latLng); // Set the marker
      setCoordinates(latLng);

      try {
        // Perform Reverse Geocoding
        const results = await getGeocode({ location: latLng });
        
        // Use the formatted address from the first result
        const fullAddress = results[0]?.formatted_address || "Address not found";
        setAddress(fullAddress);
        setSelectedAddress(fullAddress);
        
      } catch (error) {
        console.error("Error during reverse geocoding:", error);
        setAddress("Error fetching address");
      }
    }
  };

  // Define a stable map container style
  const mapContainerStyle = useMemo(() => ({
    width: '100%',
    position: 'relative' as const,
    zIndex: '100',
    height: isMobile ? '320px' : '400px',
    borderRadius: '0.75rem',
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
  }), [isMobile]);

  // Show search input only if allowChange is true OR no address is selected
  const showSearch = allowChange || !selectedAddress;

  return (
    <div className="flex flex-col gap-2 w-full ">
      
      {/* Search Input (Places Autocomplete) - Only show if allowed or no address selected */}
      {showSearch && (
        <div>
          <PlacesAutoComplete setSelected={setSelected} setMapToOpen={setMapOpen} setAddress={setAddress} />
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
                  setSelected(latLng);
                  setCoordinates(latLng);
                  setMapOpen(true);
                  try {
                    const results = await getGeocode({ location: latLng });
                    const fullAddress = results[0]?.formatted_address || "Address not found";
                    setAddress(fullAddress);
                    setSelectedAddress(fullAddress);
                  } catch (err) {
                    console.error("Reverse geocode failed", err);
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
            <Locate className="text-primary"/>
            {locating ? "Locating..." : "Use current location"}
          </button>
        </div>
      )}
      <AddressDisplay address={selectedAddress || address} />
      {mapOpen?<button className="px-5 cursor-pointer py-2 hover:bg-secondary hover:text-accents w-full font-sifonn rounded-md bg-primary text-accents text-xs md:text-lg" onClick={()=>{setSelectedAddress(address ?? ""); if(selected){setCoordinates(selected)}; setMapOpen(false)}}>Confirm Delivery Address</button>:null}

      {/* Google Map */}
      {mapOpen ? (
        <div className="w-full">
          <GoogleMap 
            zoom={14}
            center={selected || center}
            mapContainerStyle={mapContainerStyle}
            options={{ disableDefaultUI: true, zoomControl: true }}
            onClick={onMapClick}
          >
            {selected && (
              <Marker
                position={selected}
                draggable
                onDragEnd={(e: google.maps.MapMouseEvent) => onMapClick(e)}
              />
            )}
          </GoogleMap>
        </div>
      ) : null}
    </div>
  )
}

const PlacesAutoComplete = ({setSelected,setAddress, setMapToOpen}:PlacesAutoCompleteProps)=>{
  const {
    ready,
    value,
    setValue,
    suggestions:{status,data},
    clearSuggestions,
    init,
  } = usePlacesAutocomplete({
    initOnMount: false,
    requestOptions:{
      locationRestriction: KARACHI_BOUNDS,
      componentRestrictions: { country: "pk" },
    },
  });

  useEffect(() => {
    init();
  }, [init]);

  const handleSelect = async (valadd: string) => {
    setValue(valadd, false);
    clearSuggestions();
    // setAddress(null);
    const results = await getGeocode({ address: valadd });
    const { lat, lng } = await getLatLng(results[0]);
    setSelected({ lat, lng });
    setMapToOpen(true);
    setAddress(valadd);
  }
  return (
    <Combobox onSelect={handleSelect}>
      <ComboboxInput
        value={value}
        onChange = {(e)=>setValue(e.target.value)}
        disabled={!ready}
        placeholder="Search an Address"
        className="w-full"
      />
      <ComboboxPopover className="!z-[10020] bg-white shadow-lg">
        <ComboboxList>
          {status==='OK' && data.map(({place_id,description})=>
          <ComboboxOption key={place_id} value={description}/>
          )}
        </ComboboxList>
      </ComboboxPopover>
    </Combobox>
  )
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