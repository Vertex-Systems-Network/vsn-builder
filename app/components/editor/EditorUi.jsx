import PolarisIcon from "../ui/PolarisIcon";

const cx = (...items) => items.filter(Boolean).join(" ");

export function VsnButton({
  variant = "secondary",
  size = "md",
  tone,
  loading = false,
  disabled = false,
  accessibilityLabel,
  interestFor,
  className = "",
  children,
  type = "button",
  title: tooltip,
  ...props
}) {
  const variantClass = {
    primary: "is-primary",
    secondary: "is-secondary",
    tertiary: "is-tertiary",
    plain: "is-plain",
    icon: "is-icon",
  }[variant] || "is-secondary";
  const sizeClass = size === "sm" ? "is-sm" : size === "lg" ? "is-lg" : "is-md";
  const toneClass = tone === "critical" ? "is-critical" : tone === "success" ? "is-success" : "";
  return (
    <button
      type={type}
      {...props}
      disabled={disabled || Boolean(loading)}
      aria-busy={loading || undefined}
      aria-label={accessibilityLabel || props["aria-label"]}
      data-tooltip={props["data-tooltip"] || tooltip || (variant === "icon" ? accessibilityLabel : undefined)}
      className={cx("vsn-ui-button", variantClass, sizeClass, toneClass, className)}
    >
      {loading ? <span className="vsn-ui-button-spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

function FieldShell({ label, hidden, helpText = "", error = "", children, className = "" }) {
  return (
    <label className={cx("vsn-ui-field-shell", error && "has-error", className)}>
      {!hidden && label ? <span className="vsn-ui-field-label">{label}</span> : null}
      {children}
      {error ? <span className="vsn-ui-field-error">{error}</span> : helpText ? <span className="vsn-ui-field-help">{helpText}</span> : null}
    </label>
  );
}

function inputAria(label, labelAccessibilityVisibility, props) {
  return labelAccessibilityVisibility === "exclusive" ? label : props["aria-label"];
}

export function VsnTextField({ label, labelAccessibilityVisibility, helpText, error, className = "", ...props }) {
  return <FieldShell label={label} hidden={labelAccessibilityVisibility === "exclusive"} helpText={helpText} error={error}><input type="text" {...props} className={cx("vsn-ui-input", className)} aria-label={inputAria(label, labelAccessibilityVisibility, props)} /></FieldShell>;
}
export function VsnUrlField({ label, labelAccessibilityVisibility, helpText, error, className = "", ...props }) {
  return <FieldShell label={label} hidden={labelAccessibilityVisibility === "exclusive"} helpText={helpText} error={error}><input type="url" {...props} className={cx("vsn-ui-input", className)} aria-label={inputAria(label, labelAccessibilityVisibility, props)} /></FieldShell>;
}
export function VsnNumberField({ label, labelAccessibilityVisibility, helpText, error, className = "", ...props }) {
  return <FieldShell label={label} hidden={labelAccessibilityVisibility === "exclusive"} helpText={helpText} error={error}><input type="number" inputMode="decimal" {...props} className={cx("vsn-ui-input", className)} aria-label={inputAria(label, labelAccessibilityVisibility, props)} /></FieldShell>;
}
export function VsnSearchField({ label, labelAccessibilityVisibility, helpText, error, className = "", ...props }) {
  return <FieldShell label={label} hidden={labelAccessibilityVisibility === "exclusive"} helpText={helpText} error={error}><span className="vsn-ui-search-wrap"><PolarisIcon type="search" size={16}/><input type="search" {...props} className={cx("vsn-ui-input", className)} aria-label={inputAria(label, labelAccessibilityVisibility, props)} /></span></FieldShell>;
}
export function VsnTextArea({ label, labelAccessibilityVisibility, helpText, error, className = "", inputRef, ...props }) {
  return <FieldShell label={label} hidden={labelAccessibilityVisibility === "exclusive"} helpText={helpText} error={error}><textarea ref={inputRef} {...props} className={cx("vsn-ui-textarea", className)} aria-label={inputAria(label, labelAccessibilityVisibility, props)} /></FieldShell>;
}
export function VsnSelect({ label, labelAccessibilityVisibility, helpText, error, className = "", children, ...props }) {
  return <FieldShell label={label} hidden={labelAccessibilityVisibility === "exclusive"} helpText={helpText} error={error}><span className="vsn-ui-select-wrap"><select {...props} className={cx("vsn-ui-select", className)} aria-label={inputAria(label, labelAccessibilityVisibility, props)}>{children}</select><PolarisIcon type="chevron-down" size={14}/></span></FieldShell>;
}
export function VsnOption({ children, ...props }) { return <option {...props}>{children}</option>; }
export function VsnCheckbox({ children, className = "", checked = false, onChange, disabled = false, ...props }) {
  const handleChange = (event) => {
    event.stopPropagation();
    onChange?.(event);
  };
  return <label className={cx("vsn-ui-checkbox", className)} onClick={(event) => event.stopPropagation()}><input type="checkbox" {...props} checked={checked === true} disabled={disabled} onClick={(event) => event.stopPropagation()} onChange={handleChange}/><span className="vsn-ui-checkbox-box"><PolarisIcon type="check" size={12}/></span><span className="vsn-ui-checkbox-label">{children}</span></label>;
}
export function VsnColorField({ label, labelAccessibilityVisibility, className = "", value = "#000000", onInput, ...props }) {
  return <FieldShell label={label} hidden={labelAccessibilityVisibility === "exclusive"}><span className="vsn-ui-color-wrap"><span className="vsn-ui-color-chip" style={{background:value || "#000000"}}/><input type="text" value={value || "#000000"} {...props} onInput={onInput} className={cx("vsn-ui-input", className)} aria-label={inputAria(label, labelAccessibilityVisibility, props)} /></span></FieldShell>;
}
export function VsnDateField({ label, labelAccessibilityVisibility, helpText, error, className = "", ...props }) {
  return <FieldShell label={label} hidden={labelAccessibilityVisibility === "exclusive"} helpText={helpText} error={error}><input type="date" {...props} className={cx("vsn-ui-input", className)} aria-label={inputAria(label, labelAccessibilityVisibility, props)} /></FieldShell>;
}
export function VsnUnitField({ label, value = "", unit = "px", onInput, placeholder = "0", className = "" }) {
  return <FieldShell label={label} hidden={!label}><span className={cx("vsn-ui-unit-wrap", !unit && "has-no-unit")}><input type="text" inputMode="decimal" value={value ?? ""} placeholder={placeholder} onInput={onInput} className={cx("vsn-ui-input", className)} />{unit ? <span>{unit}</span> : null}</span></FieldShell>;
}
export function VsnSpinner({ accessibilityLabel = "Loading" }) { return <span className="vsn-ui-spinner" role="status" aria-label={accessibilityLabel} />; }
