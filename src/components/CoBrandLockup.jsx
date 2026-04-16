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
        <img 
          src="/branding/nhc-logo.png" 
          alt="NHC platform dashboard" 
          className="co-brand-logo-nhc" 
        />

        <div className="co-brand-divider" aria-hidden="true" />

        <div className="co-brand-partner-block">
          <span className="co-brand-powered">
            {variant === 'print' ? 'في شراكة مع' : <>
              Proudly Developed in <strong>Saudi Arabia</strong>
              <br />
              <span className="co-brand-powered-secondary">by Chessboard Group</span>
            </>}
          </span>
          <img 
            src="/branding/chessboard-logo.png" 
            alt="Chessboard technology partner" 
            className="co-brand-logo-chess" 
          />
        </div>
      </div>
    </div>
  )
}
