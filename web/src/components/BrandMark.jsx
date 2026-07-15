/** Shared brand mark — ROM is the hero-level short name. */
export default function BrandMark({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'text-sm tracking-[0.2em]',
    md: 'text-5xl tracking-[0.14em] md:text-6xl',
    lg: 'text-5xl tracking-[0.14em] md:text-7xl',
    loading: 'text-2xl tracking-[0.22em]',
  };
  return (
    <p
      className={`font-display font-extrabold leading-none text-lime ${sizes[size] || sizes.md} ${className}`}
    >
      ROM
    </p>
  );
}

export function BrandSubline({ className = '' }) {
  return (
    <p className={`text-sm uppercase tracking-[0.22em] text-mist-muted ${className}`}>
      Remote Ops Manager
    </p>
  );
}
