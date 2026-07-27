"use client";

import SearchBar from "./components/SearchBar";
import Carousel from "./components/Carousel";
import Categories from "./components/Categories";
import Deals from "./components/Deals";
import AllProductsGrid from "./components/AllProductsGrid";

/** Client home tree — keep-alive can freeze this without fighting RSC remounts. */
export default function HomeClient() {
  return (
    <main>
      <SearchBar />
      <Carousel />
      <Categories />
      <Deals Name="Hot Deals - On the Clock" />
      <AllProductsGrid />
    </main>
  );
}
