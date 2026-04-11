export default function CoBrandLockup({
  variant = 'dark',
  sidebarAdaptive = false,
  animateConnector = false,
  className = '',
}) {
  const variantClass =
    variant === 'light' ? 'co-brand-light' : variant === 'print' ? 'co-brand-print' : 'co-brand-dark'

  const classes = [
    'co-brand-lockup',
    variantClass,
    sidebarAdaptive ? 'sidebar-adaptive' : '',
    animateConnector ? 'co-brand-login-animated' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes}>
      <div className="co-brand-row">
        <img src="/branding/nhc-logo.png" alt="NHC" className="co-brand-logo-nhc" />

        <div className="co-brand-connector-stack">
          {variant === 'print' && <p className="co-brand-print-tagline">في شراكة مع</p>}
          <span className="co-brand-connector" />
        </div>

        <div className="text-right">
          <img src="/branding/chessboard-logo.jpeg" alt="Chessboard" className="co-brand-logo-chess" />
          <p className="co-brand-powered">Powered by Chessboard</p>
        </div>
      </div>
    </div>
  )
}
