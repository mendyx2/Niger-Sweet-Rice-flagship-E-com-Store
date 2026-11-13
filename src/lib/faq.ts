import { site } from "./site";
import { RETURN_WINDOW_HOURS } from "./rewards";

/** Shared FAQ content: used on /faq (with FAQPage structured data) and on area pages. */
export const FAQ: { q: string; a: string }[] = [
  {
    q: "Where can I buy rice in Abuja?",
    a: `Order ${site.name} online for delivery across Abuja and nearby towns, or pick it up from our flagship store${site.area ? ` in ${site.area}` : ""}.`,
  },
  {
    q: "What bag sizes do you sell?",
    a: "50kg, 25kg, 5kg and 1kg bags. Each product page shows the price per kg so you can compare sizes.",
  },
  {
    q: "How much is delivery?",
    a: "Delivery is a base fee for your area plus a small charge per kg. You see the exact fee in your cart as soon as you choose your area. Pickup from our flagship store is free.",
  },
  {
    q: "Do you deliver outside Abuja?",
    a: "Yes, to nearby towns including Suleja, Madalla, Zuba, Mararaba, Nyanya, Karu, Masaka, Kuje and Bwari. A minimum order applies (usually 50kg).",
  },
  {
    q: "How do I pay?",
    a: "By bank transfer to the seller shown on your order (your local distributor or Naija Sweet Rice HQ), using your order number as the narration. We don't take pay-on-delivery at the moment.",
  },
  {
    q: "What if my bag arrives damaged?",
    a: `Report it within ${RETURN_WINDOW_HOURS} hours of delivery with a photo. If it's torn, wet, tampered with, underweight or the wrong size, we collect it and bring you a new bag for free.`,
  },
  {
    q: "Can I try the rice before buying a big bag?",
    a: "Yes. Request a free 1kg sample. The rice is free; you only pay delivery, or pick it up free at the store.",
  },
  {
    q: "How do purchase points work?",
    a: "You earn a point for every ₦100 you spend. Once the return window on an order has passed, swap points for discount coupons: 500 points for ₦2,000 off, 1,000 for ₦5,000 off, 2,500 for ₦15,000 off.",
  },
  {
    q: "Do you sell wholesale?",
    a: "Yes. Shops, caterers, restaurants and distributors can apply to sell or resell our rice and get wholesale prices once approved.",
  },
];
