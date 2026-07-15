import { Link } from 'react-router-dom';
import BrandMark from '../components/BrandMark.jsx';
import { useAuth, homePath } from '../lib/auth.jsx';

export default function AccessDenied() {
  const { user } = useAuth();
  return (
    <div className="rom-shell flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <BrandMark size="md" />
      <h1 className="mt-8 font-display text-3xl font-bold text-mist">Access Denied</h1>
      <p className="mt-3 max-w-md text-mist-muted">
        Your role ({user?.role || 'unknown'}) cannot open this page. If you believe this is a mistake,
        contact an administrator.
      </p>
      <Link
        to={homePath(user)}
        className="touch-target mt-8 bg-blue px-5 py-3 font-display text-sm font-bold text-white"
      >
        Go to your home
      </Link>
    </div>
  );
}
