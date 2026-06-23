// Maps country names to flag emojis
const FLAG_MAP: Record<string, string> = {
  "Argentina": "🇦🇷", "Brazil": "🇧🇷", "France": "🇫🇷", "England": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "Spain": "🇪🇸", "Germany": "🇩🇪", "Portugal": "🇵🇹", "Netherlands": "🇳🇱",
  "Belgium": "🇧🇪", "Italy": "🇮🇹", "Croatia": "🇭🇷", "Uruguay": "🇺🇾",
  "Poland": "🇵🇱", "Senegal": "🇸🇳", "Morocco": "🇲🇦", "Denmark": "🇩🇰",
  "Switzerland": "🇨🇭", "Norway": "🇳🇴", "Sweden": "🇸🇪", "USA": "🇺🇸",
  "Mexico": "🇲🇽", "Colombia": "🇨🇴", "Chile": "🇨🇱", "Ecuador": "🇪🇨",
  "Japan": "🇯🇵", "South Korea": "🇰🇷", "Egypt": "🇪🇬", "Nigeria": "🇳🇬",
  "Austria": "🇦🇹", "Greece": "🇬🇷", "Turkey": "🇹🇷", "Algeria": "🇩🇿",
  "Serbia": "🇷🇸", "Slovakia": "🇸🇰", "Czech Republic": "🇨🇿", "Hungary": "🇭🇺",
  "Ukraine": "🇺🇦", "Russia": "🇷🇺", "Albania": "🇦🇱", "Wales": "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
  "Scotland": "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "Ireland": "🇮🇪", "Australia": "🇦🇺", "Iran": "🇮🇷",
  "Saudi Arabia": "🇸🇦", "Qatar": "🇶🇦", "Cameroon": "🇨🇲", "Ghana": "🇬🇭",
  "Ivory Coast": "🇨🇮", "Tunisia": "🇹🇳", "Mali": "🇲🇱", "Slovenia": "🇸🇮",
  "Romania": "🇷🇴", "Georgia": "🇬🇪", "Bosnia": "🇧🇦", "North Macedonia": "🇲🇰",
  "Peru": "🇵🇪", "Paraguay": "🇵🇾", "Venezuela": "🇻🇪", "Bolivia": "🇧🇴",
  "Costa Rica": "🇨🇷", "Canada": "🇨🇦", "Jamaica": "🇯🇲", "Iceland": "🇮🇸",
  "Finland": "🇫🇮", "Cyprus": "🇨🇾", "Israel": "🇮🇱", "Montenegro": "🇲🇪",
  "Luxembourg": "🇱🇺", "Kosovo": "🇽🇰", "Andorra": "🇦🇩", "Malta": "🇲🇹",
  "China": "🇨🇳", "India": "🇮🇳", "Thailand": "🇹🇭", "Burkina Faso": "🇧🇫",
  "Cape Verde": "🇨🇻", "Gambia": "🇬🇲", "Guinea": "🇬🇳", "Guinea-Bissau": "🇬🇼",
  "Comoros": "🇰🇲", "Mozambique": "🇲🇿", "Equatorial Guinea": "🇬🇶",
  "Uganda": "🇺🇬", "Libya": "🇱🇾", "Congo DR": "🇨🇩",
};

export function getCountryFlag(country: string): string {
  return FLAG_MAP[country] || "🏳️";
}

// 1. Map country names to standard ISO 2-letter codes
const COUNTRY_TO_ISO: Record<string, string> = {
  "Argentina": "ar", "Brazil": "br", "France": "fr", "England": "gb-eng",
  "Spain": "es", "Germany": "de", "Portugal": "pt", "Netherlands": "nl",
  "Belgium": "be", "Italy": "it", "Croatia": "hr", "Uruguay": "uy",
  "Poland": "pl", "Senegal": "sn", "Morocco": "ma", "Denmark": "dk",
  "Switzerland": "ch", "Norway": "no", "Sweden": "se", "USA": "us",
  "Mexico": "mx", "Colombia": "co", "Chile": "cl", "Ecuador": "ec",
  "Japan": "jp", "South Korea": "kr", "Egypt": "eg", "Nigeria": "ng",
  "Austria": "at", "Greece": "gr", "Turkey": "tr", "Algeria": "dz",
  "Serbia": "rs", "Slovakia": "sk", "Czech Republic": "cz", "Hungary": "hu",
  "Ukraine": "ua", "Russia": "ru", "Albania": "al", "Wales": "gb-wls",
  "Scotland": "gb-sct", "Ireland": "ie", "Australia": "au", "Iran": "ir",
  "Saudi Arabia": "sa", "Qatar": "qa", "Cameroon": "cm", "Ghana": "gh",
  "Ivory Coast": "ci", "Tunisia": "tn", "Mali": "ml", "Slovenia": "si",
  "Romania": "ro", "Georgia": "ge", "Bosnia": "ba", "North Macedonia": "mk",
  "Peru": "pe", "Paraguay": "py", "Venezuela": "ve", "Bolivia": "bo",
  "Costa Rica": "cr", "Canada": "ca", "Jamaica": "jm", "Iceland": "is",
  "Finland": "fi", "Cyprus": "cy", "Israel": "il", "Montenegro": "me",
  "Luxembourg": "lu", "Kosovo": "xk", "Andorra": "ad", "Malta": "mt",
  "China": "cn", "India": "in", "Thailand": "th", "Burkina Faso": "bf",
  "Cape Verde": "cv", "Gambia": "gm", "Guinea": "gn", "Guinea-Bissau": "gw",
  "Comoros": "km", "Mozambique": "mz", "Equatorial Guinea": "gq",
  "Uganda": "ug", "Libya": "ly", "Congo DR": "cd","Holland":'nl',"cote d'ivoire":'ci',"Côte d'Ivoire":'ci'
};

// 2. Return the image URL instead of an emoji string
export function getCountryFlagUrl(country: string): string {
  const code = COUNTRY_TO_ISO[country];
  if (!code) return "https://flagcdn.com/w40/un.png"; // Fallback to UN flag if not found
  
  // Flagcdn supports standard sizes (w20, w40, w80, etc.)
  return `https://flagcdn.com/w40/${code}.png`;
}