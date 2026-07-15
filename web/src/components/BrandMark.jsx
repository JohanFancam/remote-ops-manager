export default function BrandMark({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'text-sm tracking-[0.2em]',
    md: 'text-4xl tracking-[0.14em] md:text-5xl',
    lg: 'text-5xl tracking-[0.12em] md:text-6xl',
    loading: 'text-2xl tracking-[0.2em]',
  };
  return (
    <p className={`font-display font-extrabold leading-none text-blue-bright ${sizes[size]} ${className}`}>
      ROM
    </p>
  );
}

export function BrandSubline({ className = '' }) {
  return (
    <p className={`text-xs uppercase tracking-[0.22em] text-mist-muted ${className}`}>
      Remote Ops Manager
    </p>
  );
}
