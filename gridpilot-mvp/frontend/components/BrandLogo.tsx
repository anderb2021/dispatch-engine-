type BrandLogoProps = {
  href?: string;
  className?: string;
  imageClassName?: string;
};

export function BrandLogo({
  href = "/",
  className = "",
  imageClassName = "h-10 w-auto sm:h-[4.375rem]",
}: BrandLogoProps) {
  return (
    <a href={href} className={`relative z-50 inline-flex items-center ${className}`}>
      <img src="/gridpilot-logo.png?v=8" alt="GridPilot" className={`relative z-50 ${imageClassName}`} />
    </a>
  );
}
