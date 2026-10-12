import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Engineering Calculators",
  description: "Free electronics calculators from Compex Solution, including an Ohm's Law calculator and a unit converter.",
  path: "/tools/calculators",
});

export default function CalculatorsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
