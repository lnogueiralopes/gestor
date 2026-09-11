export type Product = {
  id: string;
  sku: string;
  name: string;
  ean: string;
  eanIsInternal: boolean;
  cost: number;
  margin: number;
  stock: number;
};

export type Kit = {
  ean: string;
  eanIsInternal: boolean;
  id: string;
  sku: string;
  name: string;
  components: string;
  units: number;
  available: number;
};

export type ChannelCell = {
  status: "active" | "paused" | "draft" | "error" | "none";
  price?: number;
};

export const products: Product[] = [
  { id: "p1", sku: "7790000000011", name: "Catena Malbec 750ml", ean: "7790000000011", eanIsInternal: false, cost: 70, margin: 30, stock: 30 },
  { id: "p2", sku: "7790000000028", name: "Rutini Malbec 750ml", ean: "7790000000028", eanIsInternal: false, cost: 82, margin: 28, stock: 12 },
  { id: "p3", sku: "7790000000035", name: "Alamos Malbec 750ml", ean: "7790000000035", eanIsInternal: false, cost: 55, margin: 25, stock: 18 }
];

export const kits: Kit[] = [
  { id: "k1", ean: "0400000000015", eanIsInternal: true, sku: "7790000000011_x2", name: "Kit 2 Catena Malbec", components: "2× 7790000000011", units: 2, available: 15 },
  { id: "k2", ean: "0400000000022", eanIsInternal: true, sku: "7790000000011_x3", name: "Kit 3 Catena Malbec", components: "3× 7790000000011", units: 3, available: 10 },
  { id: "k3", ean: "0400000000039", eanIsInternal: true, sku: "kitmix_00001", name: "Trio Argentina", components: "7790000000011 + 7790000000028 + 7790000000035", units: 3, available: 12 }
];

export const accounts = [
  { id: "ml1", name: "ML Principal", channel: "Mercado Livre" },
  { id: "sh1", name: "Shopee Principal", channel: "Shopee" },
  { id: "rd1", name: "Ruta Direct Shop", channel: "Ruta Direct Shop" }
];

export const productMatrix: Record<string, Record<string, ChannelCell>> = {
  p1: { ml1: { status: "active", price: 129.9 }, sh1: { status: "active", price: 124.9 }, rd1: { status: "active", price: 119.9 } },
  p2: { ml1: { status: "active", price: 169.9 }, sh1: { status: "none" }, rd1: { status: "active", price: 159.9 } },
  p3: { ml1: { status: "none" }, sh1: { status: "paused", price: 99.9 }, rd1: { status: "none" } }
};

export const kitMatrix: Record<string, Record<string, ChannelCell>> = {
  k1: { ml1: { status: "active", price: 249.9 }, sh1: { status: "active", price: 239.9 }, rd1: { status: "active", price: 229.9 } },
  k2: { ml1: { status: "none" }, sh1: { status: "none" }, rd1: { status: "draft", price: 329.9 } },
  k3: { ml1: { status: "active", price: 399.9 }, sh1: { status: "none" }, rd1: { status: "none" } }
};

export const pricingParameters = [
  { key: "tax", label: "Imposto", value: "8,00", suffix: "%" },
  { key: "packaging", label: "Embalagem por unidade", value: "3,50", suffix: "R$" },
  { key: "operational", label: "Custo operacional fixo", value: "2,00", suffix: "R$" },
  { key: "safety", label: "Reserva / segurança", value: "0,00", suffix: "%" }
];

export const kitRules = [
  { qty: "1", reduction: "0,00" },
  { qty: "2", reduction: "1,00" },
  { qty: "3", reduction: "1,00" },
  { qty: "4", reduction: "2,00" },
  { qty: "5", reduction: "2,00" },
  { qty: "6", reduction: "3,00" },
  { qty: ">6", reduction: "3,00" }
];
