/** Public store details. Set in env so they match Google Business Profile exactly (NAP consistency). */
export const site = {
  name: "Niger Sweet Rice",
  legalName: "Niger Sweet Rice Flagship Store",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  phone: process.env.NEXT_PUBLIC_STORE_PHONE ?? "",
  whatsapp: process.env.NEXT_PUBLIC_STORE_WHATSAPP ?? "",
  street: process.env.NEXT_PUBLIC_STORE_STREET ?? "",
  area: process.env.NEXT_PUBLIC_STORE_AREA ?? "",
  city: "Abuja",
  region: "FCT",
  country: "NG",
  lat: process.env.NEXT_PUBLIC_STORE_LAT ?? "",
  lng: process.env.NEXT_PUBLIC_STORE_LNG ?? "",
  hours: "Mo-Sa 08:00-19:00",
  hoursLabel: "Monday – Saturday, 8am – 7pm",
};
