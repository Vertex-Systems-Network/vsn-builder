export default function Button({ variant = "secondary", size = "md", children, icon, iconRight, loading = false, className = "", disabled, ...props }) {
  return (
    <button
      type={props.type || "button"}
      className={`vsn-button vsn-button--${variant} vsn-button--${size} ${className}`.trim()}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span className="vsn-button-spinner" aria-hidden="true" /> : icon}
      {children}
      {!loading ? iconRight : null}
    </button>
  );
}
