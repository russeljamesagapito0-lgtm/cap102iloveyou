import Icon from './Icon';

export default function StatCard({
  label,
  value,
  sub,
  icon,
  trend,
  trendTone = 'up',
  footer,
}) {
  const footerText = footer || sub;

  return (
    <div className="stat-card-v2">
      <div className="top-row">
        <div>
          <div className="label">{label}</div>
          <div className="value-row">
            <span className="value">{value}</span>
            {trend && (
              <span className={`trend-text trend-${trendTone}`}>{trend}</span>
            )}
          </div>
        </div>
        {icon && (
          <div className="icon-box">
            <Icon name={icon} size={18} />
          </div>
        )}
      </div>

      {footerText && <div className="footer-row">{footerText}</div>}
    </div>
  );
}