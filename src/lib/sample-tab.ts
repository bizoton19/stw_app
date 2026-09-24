import type { ParseResult } from "./types";

/** Reference bar tab from the product plan — regression fixture for stub + math. */
export const SAMPLE_RESTAURANT = "The Bar";

export const SAMPLE_PARSE: ParseResult = {
  restaurant: SAMPLE_RESTAURANT,
  receiptDate: "2025-09-20",
  items: [
    { name: "Josephine Old Fashioned", qty: 8, total: 120.0 },
    { name: "Monkey 47", qty: 2, total: 64.0 },
    { name: "Negroni", qty: 1, total: 6.0 },
    { name: "Hemingway's Kir Royale", qty: 6, total: 78.0 },
    { name: "Apple Juice", qty: 1, total: 4.0 },
    { name: "The Botanist", qty: 1, total: 18.0 },
    { name: "Negroni", qty: 1, total: 3.0 },
    { name: "pom noir N/A", qty: 1, total: 10.0 },
    { name: "Altos Reposado Tequila", qty: 2, total: 28.0 },
    { name: "Margarita", qty: 1, total: 6.0 },
    { name: "Sundress Season", qty: 1, total: 15.0 },
    { name: "Pear Pressure", qty: 1, total: 10.0 },
    { name: "BQ Wine Package ($60)", qty: 7, total: 420.0 },
    { name: "Pineapple Juice", qty: 2, total: 10.0 },
    { name: "Espresso", qty: 5, total: 25.0 },
    { name: "Unmett Min Booze", qty: 1, total: 78.8 },
  ],
  fees: [
    { name: "Admin fee (5%)", amount: 44.79 },
    { name: "Gratuity (20%)", amount: 179.16 },
    { name: "Tax", amount: 103.4 },
  ],
};

export const SAMPLE_ITEM_SUBTOTAL_CENTS = 89580;
export const SAMPLE_FEE_TOTAL_CENTS = 32735;
export const SAMPLE_GRAND_TOTAL_CENTS = 122315;
