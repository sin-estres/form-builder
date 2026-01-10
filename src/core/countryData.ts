/**
 * Country codes data for phone ISD selector
 */

export interface CountryCode {
    code: string;      // ISO 3166-1 alpha-2 code: "IN", "US"
    name: string;      // Country name: "India", "United States"
    dialCode: string;  // Dial code with +: "+91", "+1"
    flag: string;      // Flag emoji: "🇮🇳", "🇺🇸"
}

/**
 * Country codes sorted by dial code (ascending), with India (+91) always first as default
 */
const COUNTRY_DATA: CountryCode[] = [
    { code: 'US', name: 'United States', dialCode: '+1', flag: '🇺🇸' },
    { code: 'CA', name: 'Canada', dialCode: '+1', flag: '🇨🇦' },
    { code: 'RU', name: 'Russia', dialCode: '+7', flag: '🇷🇺' },
    { code: 'ZA', name: 'South Africa', dialCode: '+27', flag: '🇿🇦' },
    { code: 'NL', name: 'Netherlands', dialCode: '+31', flag: '🇳🇱' },
    { code: 'FR', name: 'France', dialCode: '+33', flag: '🇫🇷' },
    { code: 'ES', name: 'Spain', dialCode: '+34', flag: '🇪🇸' },
    { code: 'IT', name: 'Italy', dialCode: '+39', flag: '🇮🇹' },
    { code: 'CH', name: 'Switzerland', dialCode: '+41', flag: '🇨🇭' },
    { code: 'GB', name: 'United Kingdom', dialCode: '+44', flag: '🇬🇧' },
    { code: 'DK', name: 'Denmark', dialCode: '+45', flag: '🇩🇰' },
    { code: 'SE', name: 'Sweden', dialCode: '+46', flag: '🇸🇪' },
    { code: 'NO', name: 'Norway', dialCode: '+47', flag: '🇳🇴' },
    { code: 'PL', name: 'Poland', dialCode: '+48', flag: '🇵🇱' },
    { code: 'DE', name: 'Germany', dialCode: '+49', flag: '🇩🇪' },
    { code: 'MX', name: 'Mexico', dialCode: '+52', flag: '🇲🇽' },
    { code: 'BR', name: 'Brazil', dialCode: '+55', flag: '🇧🇷' },
    { code: 'MY', name: 'Malaysia', dialCode: '+60', flag: '🇲🇾' },
    { code: 'AU', name: 'Australia', dialCode: '+61', flag: '🇦🇺' },
    { code: 'ID', name: 'Indonesia', dialCode: '+62', flag: '🇮🇩' },
    { code: 'PH', name: 'Philippines', dialCode: '+63', flag: '🇵🇭' },
    { code: 'NZ', name: 'New Zealand', dialCode: '+64', flag: '🇳🇿' },
    { code: 'SG', name: 'Singapore', dialCode: '+65', flag: '🇸🇬' },
    { code: 'TH', name: 'Thailand', dialCode: '+66', flag: '🇹🇭' },
    { code: 'JP', name: 'Japan', dialCode: '+81', flag: '🇯🇵' },
    { code: 'KR', name: 'South Korea', dialCode: '+82', flag: '🇰🇷' },
    { code: 'VN', name: 'Vietnam', dialCode: '+84', flag: '🇻🇳' },
    { code: 'CN', name: 'China', dialCode: '+86', flag: '🇨🇳' },
    { code: 'PK', name: 'Pakistan', dialCode: '+92', flag: '🇵🇰' },
    { code: 'LK', name: 'Sri Lanka', dialCode: '+94', flag: '🇱🇰' },
    { code: 'IE', name: 'Ireland', dialCode: '+353', flag: '🇮🇪' },
    { code: 'BD', name: 'Bangladesh', dialCode: '+880', flag: '🇧🇩' },
    { code: 'SA', name: 'Saudi Arabia', dialCode: '+966', flag: '🇸🇦' },
    { code: 'AE', name: 'UAE', dialCode: '+971', flag: '🇦🇪' },
    { code: 'NP', name: 'Nepal', dialCode: '+977', flag: '🇳🇵' },
];

// India is always first
const INDIA: CountryCode = { code: 'IN', name: 'India', dialCode: '+91', flag: '🇮🇳' };

/**
 * Exported country codes list with India at top, rest sorted by dial code ascending
 */
export const COUNTRY_CODES: CountryCode[] = [
    INDIA,
    ...COUNTRY_DATA.sort((a, b) => {
        // Sort by numeric value of dial code
        const numA = parseInt(a.dialCode.replace('+', ''));
        const numB = parseInt(b.dialCode.replace('+', ''));
        return numA - numB;
    })
];

/**
 * Get country by dial code
 */
export function getCountryByDialCode(dialCode: string): CountryCode | undefined {
    return COUNTRY_CODES.find(c => c.dialCode === dialCode);
}

/**
 * Get country by ISO code
 */
export function getCountryByCode(isoCode: string): CountryCode | undefined {
    return COUNTRY_CODES.find(c => c.code === isoCode);
}

/**
 * Get default country (India)
 */
export function getDefaultCountry(): CountryCode {
    return INDIA;
}
