import { useAuth } from '../context/AuthContext';

const getFullName = (profile) =>
  [profile?.first_name, profile?.middle_name, profile?.last_name, profile?.suffix]
    .filter(Boolean)
    .join(' ') ||
  profile?.email ||
  'Admin';

const getInitials = (name) =>
  name
    .split(' ')
    .map((w) => w[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 2) || 'A';

export default function Avatar({ size = 32 }) {
  const { profile } = useAuth();
  const fullName = getFullName(profile);
  const initials = getInitials(fullName);

  return (
    <div
      className="avatar-circle"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      title={fullName}
    >
      {initials}
    </div>
  );
}