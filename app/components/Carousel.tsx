"use client";
import React, { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Card from "./Card";
import { useCartContext } from "../context/CartContext";

type BannerSlide = {
  image: string;
  title: string;
};

const Carousel: React.FC = () => {
  const { cartItems, CartOpen } = useCartContext();
  const isCartOpen = cartItems.length > 0 && CartOpen;

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "center",
    slidesToScroll: 1,
  });

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);
  const [cards, setCards] = useState<BannerSlide[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/banners");
        if (!res.ok) return;
        const data = (await res.json()) as Array<{
          imageUrl?: string;
          title?: string | null;
        }>;
        if (cancelled || !Array.isArray(data)) return;
        setCards(
          data
            .filter((b) => typeof b.imageUrl === "string" && b.imageUrl.trim())
            .map((b, i) => ({
              image: b.imageUrl!.trim(),
              title: (b.title && b.title.trim()) || `Banner ${i + 1}`,
            }))
        );
      } catch {
        /* keep empty */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback((i: number) => emblaApi?.scrollTo(i), [emblaApi]);

  // Auto-slide every 3 seconds
  useEffect(() => {
    if (!emblaApi || cards.length === 0) return;
    const interval = setInterval(() => {
      emblaApi.scrollNext();
    }, 3000);
    const stop = () => clearInterval(interval);
    emblaApi.on("pointerDown", stop);
    return () => {
      clearInterval(interval);
      emblaApi.off("pointerDown", stop);
    };
  }, [emblaApi, cards.length]);

  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);

    setScrollSnaps(emblaApi.scrollSnapList());
    onSelect();

    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, cards.length]);

  const bannerHeight = "h-[200px] md:h-[380px] lg:h-[420px]";
  const hasBanners = cards.length > 0;

  return (
    <div className="w-full pt-2 mt-4 pb-4 md:py-12 px-1 sm:px-8 lg:px-14">
      <div className="flex flex-col lg:flex-row gap-4 md:gap-6 items-stretch">
        {/* Carousel */}
        {hasBanners ? (
          <div className={`relative w-full ${isCartOpen ? "lg:w-3/3" : "lg:w-2/3"} max-w-5xl ${bannerHeight}`}>
            <div className="overflow-hidden rounded-none h-full" ref={emblaRef}>
              <div className="flex h-full">
                {cards.map((card, i) => (
                  <Card key={`${card.image}-${i}`} {...card} />
                ))}
              </div>
            </div>

            <button
              onClick={scrollNext}
              className="hidden md:flex items-center justify-center absolute -right-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 rounded-full p-3 shadow transition"
            >
              <img src="./images/right-arrow.png" className="w-5" alt="Next" />
            </button>

            <div className=" hidden md:flex justify-center gap-2 mt-6">
              {scrollSnaps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => scrollTo(i)}
                  className={`h-1.5 rounded-full transition-all ${i === selectedIndex ? "w-10 bg-gray-800" : "w-6 bg-gray-300"
                    }`}
                />
              ))}
            </div>
          </div>
        ) : null}

        {/* Promo Banner */}
        {!isCartOpen && (
          <div
            className={`hidden w-full ${hasBanners ? "lg:w-1/3" : "lg:w-full max-w-md"} rounded-2xl bg-primary text-accents p-6 shadow-md md:flex flex-col ${bannerHeight}`}
          >
            <div className="flex-1 flex items-center justify-center">
              <img
                src="/images/snacksimagebanner.jpeg"
                alt="Snacks"
                className="h-full w-full object-contain drop-shadow-2xl rounded-2xl"
              />
            </div>
            <div className="mt-4 space-y-3">
              <p className="text-sm font-semibold uppercase tracking-wide opacity-80">
                Place an order now
              </p>
              <h3 className="text-2xl font-bold leading-tight">
                Find your favourite snacks and get them delivered fast.
              </h3>
              <p className="text-sm opacity-80">
                Fresh picks, quick delivery, and exclusive deals every day.
              </p>
              <button
                onClick={() => {
                  const dealsSection = document.getElementById("deals-section");
                  if (dealsSection) {
                    dealsSection.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                }}
                className="mt-1 inline-flex items-center justify-center rounded-full bg-accents text-primary px-4 py-2 text-sm font-semibold shadow hover:shadow-lg transition"
              >
                Start shopping
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Carousel;
