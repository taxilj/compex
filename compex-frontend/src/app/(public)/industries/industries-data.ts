import type { LucideIcon } from "lucide-react";
import { Factory, Cpu, Zap, Shield, Heart, Radio, Train, Wifi, Car } from "lucide-react";

export type IndustrySlug =
  | "automotive-electronics"
  | "industrial-automation"
  | "power-energy"
  | "defense-aerospace"
  | "medical-devices"
  | "consumer-electronics"
  | "telecom-networking"
  | "railway-infrastructure"
  | "iot-embedded-systems";

export interface Industry {
  slug: IndustrySlug;
  icon: LucideIcon;
  name: string;
  desc: string;
  image: string;
  imageAlt: string;
}

// One real, licensed photo per industry -- see
// public/images/industries/SOURCES.md for source and attribution. Keying by
// IndustrySlug (a closed union) makes a missing entry a compile error, and
// object-literal keys can't collide, so every industry is guaranteed a
// distinct image without a runtime check.
const industryImages: Record<IndustrySlug, { path: string; alt: string }> = {
  "automotive-electronics": {
    path: "/images/industries/automotive-electronics.jpg",
    alt: "Automotive engine control unit (ECU) module, an example of automotive-grade electronics",
  },
  "industrial-automation": {
    path: "/images/industries/industrial-automation.jpg",
    alt: "Industrial robotic arm operating on a manufacturing line",
  },
  "power-energy": {
    path: "/images/industries/power-energy.jpg",
    alt: "Outdoor electrical power substation with transformers and switchgear",
  },
  "defense-aerospace": {
    path: "/images/industries/defense-aerospace.jpg",
    alt: "Technician servicing onboard avionics equipment in a military aircraft",
  },
  "medical-devices": {
    path: "/images/industries/medical-devices.jpg",
    alt: "Patient vital-signs monitor displaying live medical telemetry",
  },
  "consumer-electronics": {
    path: "/images/industries/consumer-electronics.jpg",
    alt: "Quality control inspector examining surface-mount (SMD) components on an assembly line",
  },
  "telecom-networking": {
    path: "/images/industries/telecom-networking.jpg",
    alt: "Telecommunications relay tower with mounted antennas",
  },
  "railway-infrastructure": {
    path: "/images/industries/railway-infrastructure.jpg",
    alt: "Rows of electromechanical relay equipment in a railway signaling room",
  },
  "iot-embedded-systems": {
    path: "/images/industries/iot-embedded-systems.jpg",
    alt: "Wireless IoT gateway module installed on a rooftop",
  },
};

const industryContent: Omit<Industry, "image" | "imageAlt">[] = [
  { slug: "automotive-electronics", icon: Car, name: "Automotive Electronics", desc: "Sourcing ICs, sensors, and power components for automotive-grade applications." },
  { slug: "industrial-automation", icon: Factory, name: "Industrial Automation", desc: "PLCs, drives, motion controllers, and embedded modules for manufacturing lines." },
  { slug: "power-energy", icon: Zap, name: "Power & Energy", desc: "Power semiconductors, MOSFETs, IGBTs, and magnetic components for energy systems." },
  { slug: "defense-aerospace", icon: Shield, name: "Defense & Aerospace", desc: "High-reliability components with full traceability for mission-critical applications." },
  { slug: "medical-devices", icon: Heart, name: "Medical Devices", desc: "Precision ICs, sensors, and passive components for medical equipment." },
  { slug: "consumer-electronics", icon: Cpu, name: "Consumer Electronics", desc: "Microcontrollers, display drivers, and connectivity modules at volume." },
  { slug: "telecom-networking", icon: Radio, name: "Telecom & Networking", desc: "RF components, transceivers, and switching ICs for communication infrastructure." },
  { slug: "railway-infrastructure", icon: Train, name: "Railway & Infrastructure", desc: "Ruggedized components for rail signaling, control, and power systems." },
  { slug: "iot-embedded-systems", icon: Wifi, name: "IoT & Embedded Systems", desc: "Wireless modules, microcontrollers, and sensors for connected product development." },
];

export const industries: Industry[] = industryContent.map((industry) => ({
  ...industry,
  image: industryImages[industry.slug].path,
  imageAlt: industryImages[industry.slug].alt,
}));
