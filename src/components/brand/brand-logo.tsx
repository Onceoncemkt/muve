import Image from "next/image";

type BrandLogoVariant = "positive" | "negative" | "icon";

interface BrandLogoProps {
  variant?: BrandLogoVariant;
  width?: number;
  className?: string;
}

const logoConfig: Record<
  BrandLogoVariant,
  { src: string; alt: string; defaultWidth: number; defaultHeight: number }
> = {
  positive: {
    src: "/brand/logo-once-once.svg",
    alt: "Once Once",
    defaultWidth: 180,
    defaultHeight: 40,
  },
  negative: {
    src: "/brand/logo-once-once-dark.svg",
    alt: "Once Once",
    defaultWidth: 180,
    defaultHeight: 40,
  },
  icon: {
    src: "/brand/logo-once-once-icon.svg",
    alt: "Once Once icon",
    defaultWidth: 36,
    defaultHeight: 36,
  },
};

export function BrandLogo({ variant = "positive", width, className }: BrandLogoProps) {
  const selected = logoConfig[variant];
  const finalWidth = width ?? selected.defaultWidth;
  const finalHeight = Math.round((finalWidth * selected.defaultHeight) / selected.defaultWidth);

  return (
    <Image
      src={selected.src}
      alt={selected.alt}
      width={finalWidth}
      height={finalHeight}
      priority
      className={className}
    />
  );
}
