export default function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <img
      className={`brand-logo ${className}`.trim()}
      src="/brand-logo.webp"
      alt=""
      aria-hidden="true"
      width="48"
      height="48"
    />
  );
}
