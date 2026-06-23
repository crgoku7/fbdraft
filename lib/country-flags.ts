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
