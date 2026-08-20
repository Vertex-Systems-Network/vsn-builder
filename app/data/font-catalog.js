export const SYSTEM_FONTS = [
  { family: "Inherit", value: "inherit", provider: "System" },
  { family: "Arial", value: "Arial, sans-serif", provider: "System" },
  { family: "Helvetica", value: "Helvetica, Arial, sans-serif", provider: "System" },
  { family: "Georgia", value: "Georgia, serif", provider: "System" },
  { family: "Times New Roman", value: '"Times New Roman", serif', provider: "System" },
  { family: "Trebuchet MS", value: '"Trebuchet MS", sans-serif', provider: "System" },
  { family: "Verdana", value: "Verdana, sans-serif", provider: "System" },
  { family: "Tahoma", value: "Tahoma, sans-serif", provider: "System" },
  { family: "Courier New", value: '"Courier New", monospace', provider: "System" },
  { family: "System UI", value: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif", provider: "System" },
];
export const FALLBACK_GOOGLE_FONTS = [
  "Inter","Roboto","Open Sans","Lato","Montserrat","Poppins","Oswald","Raleway","Nunito Sans","Nunito","Merriweather","Playfair Display","Roboto Slab","Ubuntu","PT Sans","Source Sans 3","Noto Sans","Noto Serif","Work Sans","DM Sans","Manrope","Inter Tight","Fira Sans","Mulish","Rubik","Karla","Barlow","Libre Franklin","Josefin Sans","Quicksand","Cabin","Archivo","Bebas Neue","Anton","Cormorant Garamond","Libre Baskerville","Lora","Crimson Text","EB Garamond","Alegreya","Arvo","Zilla Slab","Space Grotesk","Plus Jakarta Sans","Outfit","Urbanist","Sora","Lexend","IBM Plex Sans","IBM Plex Serif","IBM Plex Mono","Inconsolata","Roboto Mono","Source Code Pro","Fira Code","Space Mono","Pacifico","Dancing Script","Great Vibes","Cinzel","Abril Fatface","Comfortaa"
].map((family) => ({
  family,
  value: `'${family}', sans-serif`,
  provider: "Google",
  ...(family === "Inter" ? { weights: [100,200,300,400,500,600,700,800,900], styles: ["normal","italic"] } : {}),
}));
