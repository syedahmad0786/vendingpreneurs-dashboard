"use client";
/**
 * Platform logo components.
 *
 * Renders the official brand logos from /public/brand/*.svg|.avif. Each logo
 * sits in a rounded badge with the platform's accent background so the icon
 * looks consistent across the dashboard at any size. Use the `bare` prop for
 * a transparent, no-background variant (handy for the Cross-platform tab's
 * column headers).
 */

import type { ComponentType } from "react";
import Image from "next/image";

export type PlatformId =
  | "close"
  | "email"
  | "airtable"
  | "mighty"
  | "intercom"
  | "vendhub";

interface LogoProps {
  size?: number;
  mono?: boolean;
  /** When true, render the logo on a transparent background with no badge. */
  bare?: boolean;
}

interface LogoSpec {
  src: string;
  /** Brand-accent background colour for the rounded badge. */
  bg: string;
  /** Padding ratio inside the badge — some logos look small, some big. */
  pad: number;
  alt: string;
}

const SPECS: Record<PlatformId, LogoSpec> = {
  close:    { src: "/brand/close.svg",    bg: "#26be75", pad: 0.18, alt: "Close CRM" },
  email:    { src: "/brand/email.svg",    bg: "#ffffff", pad: 0.10, alt: "Email" },
  airtable: { src: "/brand/airtable.svg", bg: "#ffffff", pad: 0.08, alt: "Airtable" },
  mighty:   { src: "/brand/mighty.avif",  bg: "#ffffff", pad: 0.06, alt: "Mighty Networks" },
  intercom: { src: "/brand/intercom.svg", bg: "#1f8ded", pad: 0.16, alt: "Intercom" },
  vendhub:  { src: "/brand/vendhub.svg",  bg: "#ffffff", pad: 0.08, alt: "VendHub" },
};

function makeLogo(id: PlatformId): ComponentType<LogoProps> {
  const Logo: ComponentType<LogoProps> = ({ size = 20, mono = false, bare = false }) => {
    const spec = SPECS[id];
    const inner = Math.max(8, Math.round(size * (1 - spec.pad * 2)));
    if (bare) {
      return (
        <Image
          src={spec.src}
          alt={spec.alt}
          width={size}
          height={size}
          style={{
            width: size,
            height: size,
            objectFit: "contain",
            display: "inline-block",
            filter: mono ? "grayscale(1) brightness(0.6)" : undefined,
          }}
        />
      );
    }
    const radius = Math.max(4, Math.round(size * 0.22));
    const bg = mono ? "#0e0e0e" : spec.bg;
    return (
      <span
        aria-label={spec.alt}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: size,
          height: size,
          borderRadius: radius,
          background: bg,
          // Subtle hairline border keeps white-bg logos visible on light surfaces.
          boxShadow: bg === "#ffffff" ? "inset 0 0 0 1px rgba(0,0,0,0.06)" : undefined,
          flexShrink: 0,
        }}
      >
        <Image
          src={spec.src}
          alt={spec.alt}
          width={inner}
          height={inner}
          style={{
            width: inner,
            height: inner,
            objectFit: "contain",
            display: "block",
            filter: mono ? "grayscale(1) brightness(0.85)" : undefined,
          }}
        />
      </span>
    );
  };
  Logo.displayName = `PlatformLogo(${id})`;
  return Logo;
}

export const PlatformLogos: Record<PlatformId, ComponentType<LogoProps>> = {
  close:    makeLogo("close"),
  email:    makeLogo("email"),
  airtable: makeLogo("airtable"),
  mighty:   makeLogo("mighty"),
  intercom: makeLogo("intercom"),
  vendhub:  makeLogo("vendhub"),
};
