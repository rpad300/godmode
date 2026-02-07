-- Migration: Timezones reference table
-- Creates a reference table for all world timezones

-- Create timezones table
CREATE TABLE IF NOT EXISTS timezones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    region VARCHAR(50) NOT NULL,
    utc_offset VARCHAR(20),
    abbreviation VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_timezones_region ON timezones(region);
CREATE INDEX IF NOT EXISTS idx_timezones_code ON timezones(code);

-- Insert all world timezones
INSERT INTO timezones (code, name, region, utc_offset, abbreviation) VALUES
-- UTC
('UTC', 'Coordinated Universal Time', 'UTC', '+00:00', 'UTC'),

-- Europe
('Europe/Lisbon', 'Lisbon, Portugal', 'Europe', '+00:00', 'WET/WEST'),
('Europe/London', 'London, United Kingdom', 'Europe', '+00:00', 'GMT/BST'),
('Europe/Dublin', 'Dublin, Ireland', 'Europe', '+00:00', 'GMT/IST'),
('Europe/Paris', 'Paris, France', 'Europe', '+01:00', 'CET/CEST'),
('Europe/Brussels', 'Brussels, Belgium', 'Europe', '+01:00', 'CET/CEST'),
('Europe/Amsterdam', 'Amsterdam, Netherlands', 'Europe', '+01:00', 'CET/CEST'),
('Europe/Berlin', 'Berlin, Germany', 'Europe', '+01:00', 'CET/CEST'),
('Europe/Madrid', 'Madrid, Spain', 'Europe', '+01:00', 'CET/CEST'),
('Europe/Rome', 'Rome, Italy', 'Europe', '+01:00', 'CET/CEST'),
('Europe/Vienna', 'Vienna, Austria', 'Europe', '+01:00', 'CET/CEST'),
('Europe/Zurich', 'Zurich, Switzerland', 'Europe', '+01:00', 'CET/CEST'),
('Europe/Stockholm', 'Stockholm, Sweden', 'Europe', '+01:00', 'CET/CEST'),
('Europe/Oslo', 'Oslo, Norway', 'Europe', '+01:00', 'CET/CEST'),
('Europe/Copenhagen', 'Copenhagen, Denmark', 'Europe', '+01:00', 'CET/CEST'),
('Europe/Warsaw', 'Warsaw, Poland', 'Europe', '+01:00', 'CET/CEST'),
('Europe/Prague', 'Prague, Czech Republic', 'Europe', '+01:00', 'CET/CEST'),
('Europe/Budapest', 'Budapest, Hungary', 'Europe', '+01:00', 'CET/CEST'),
('Europe/Helsinki', 'Helsinki, Finland', 'Europe', '+02:00', 'EET/EEST'),
('Europe/Athens', 'Athens, Greece', 'Europe', '+02:00', 'EET/EEST'),
('Europe/Bucharest', 'Bucharest, Romania', 'Europe', '+02:00', 'EET/EEST'),
('Europe/Sofia', 'Sofia, Bulgaria', 'Europe', '+02:00', 'EET/EEST'),
('Europe/Kyiv', 'Kyiv, Ukraine', 'Europe', '+02:00', 'EET/EEST'),
('Europe/Istanbul', 'Istanbul, Turkey', 'Europe', '+03:00', 'TRT'),
('Europe/Moscow', 'Moscow, Russia', 'Europe', '+03:00', 'MSK'),
('Europe/Minsk', 'Minsk, Belarus', 'Europe', '+03:00', 'MSK'),

-- Americas
('America/New_York', 'New York, USA', 'Americas', '-05:00', 'EST/EDT'),
('America/Toronto', 'Toronto, Canada', 'Americas', '-05:00', 'EST/EDT'),
('America/Chicago', 'Chicago, USA', 'Americas', '-06:00', 'CST/CDT'),
('America/Denver', 'Denver, USA', 'Americas', '-07:00', 'MST/MDT'),
('America/Phoenix', 'Phoenix, USA', 'Americas', '-07:00', 'MST'),
('America/Los_Angeles', 'Los Angeles, USA', 'Americas', '-08:00', 'PST/PDT'),
('America/Vancouver', 'Vancouver, Canada', 'Americas', '-08:00', 'PST/PDT'),
('America/Anchorage', 'Anchorage, USA', 'Americas', '-09:00', 'AKST/AKDT'),
('Pacific/Honolulu', 'Honolulu, Hawaii', 'Americas', '-10:00', 'HST'),
('America/Mexico_City', 'Mexico City, Mexico', 'Americas', '-06:00', 'CST/CDT'),
('America/Bogota', 'Bogota, Colombia', 'Americas', '-05:00', 'COT'),
('America/Lima', 'Lima, Peru', 'Americas', '-05:00', 'PET'),
('America/Santiago', 'Santiago, Chile', 'Americas', '-04:00', 'CLT/CLST'),
('America/Buenos_Aires', 'Buenos Aires, Argentina', 'Americas', '-03:00', 'ART'),
('America/Sao_Paulo', 'Sao Paulo, Brazil', 'Americas', '-03:00', 'BRT/BRST'),
('America/Caracas', 'Caracas, Venezuela', 'Americas', '-04:00', 'VET'),
('America/Panama', 'Panama City, Panama', 'Americas', '-05:00', 'EST'),
('America/Puerto_Rico', 'San Juan, Puerto Rico', 'Americas', '-04:00', 'AST'),
('America/Montreal', 'Montreal, Canada', 'Americas', '-05:00', 'EST/EDT'),
('America/Halifax', 'Halifax, Canada', 'Americas', '-04:00', 'AST/ADT'),
('America/St_Johns', 'St. Johns, Canada', 'Americas', '-03:30', 'NST/NDT'),

-- Asia
('Asia/Tokyo', 'Tokyo, Japan', 'Asia', '+09:00', 'JST'),
('Asia/Seoul', 'Seoul, South Korea', 'Asia', '+09:00', 'KST'),
('Asia/Shanghai', 'Shanghai, China', 'Asia', '+08:00', 'CST'),
('Asia/Hong_Kong', 'Hong Kong', 'Asia', '+08:00', 'HKT'),
('Asia/Taipei', 'Taipei, Taiwan', 'Asia', '+08:00', 'CST'),
('Asia/Singapore', 'Singapore', 'Asia', '+08:00', 'SGT'),
('Asia/Kuala_Lumpur', 'Kuala Lumpur, Malaysia', 'Asia', '+08:00', 'MYT'),
('Asia/Bangkok', 'Bangkok, Thailand', 'Asia', '+07:00', 'ICT'),
('Asia/Ho_Chi_Minh', 'Ho Chi Minh City, Vietnam', 'Asia', '+07:00', 'ICT'),
('Asia/Jakarta', 'Jakarta, Indonesia', 'Asia', '+07:00', 'WIB'),
('Asia/Manila', 'Manila, Philippines', 'Asia', '+08:00', 'PHT'),
('Asia/Kolkata', 'Kolkata, India', 'Asia', '+05:30', 'IST'),
('Asia/Mumbai', 'Mumbai, India', 'Asia', '+05:30', 'IST'),
('Asia/Dhaka', 'Dhaka, Bangladesh', 'Asia', '+06:00', 'BST'),
('Asia/Karachi', 'Karachi, Pakistan', 'Asia', '+05:00', 'PKT'),
('Asia/Dubai', 'Dubai, UAE', 'Asia', '+04:00', 'GST'),
('Asia/Riyadh', 'Riyadh, Saudi Arabia', 'Asia', '+03:00', 'AST'),
('Asia/Jerusalem', 'Jerusalem, Israel', 'Asia', '+02:00', 'IST/IDT'),
('Asia/Beirut', 'Beirut, Lebanon', 'Asia', '+02:00', 'EET/EEST'),
('Asia/Tehran', 'Tehran, Iran', 'Asia', '+03:30', 'IRST/IRDT'),
('Asia/Kabul', 'Kabul, Afghanistan', 'Asia', '+04:30', 'AFT'),
('Asia/Almaty', 'Almaty, Kazakhstan', 'Asia', '+06:00', 'ALMT'),
('Asia/Tashkent', 'Tashkent, Uzbekistan', 'Asia', '+05:00', 'UZT'),
('Asia/Kathmandu', 'Kathmandu, Nepal', 'Asia', '+05:45', 'NPT'),
('Asia/Colombo', 'Colombo, Sri Lanka', 'Asia', '+05:30', 'IST'),
('Asia/Yangon', 'Yangon, Myanmar', 'Asia', '+06:30', 'MMT'),
('Asia/Vladivostok', 'Vladivostok, Russia', 'Asia', '+10:00', 'VLAT'),

-- Africa
('Africa/Cairo', 'Cairo, Egypt', 'Africa', '+02:00', 'EET'),
('Africa/Johannesburg', 'Johannesburg, South Africa', 'Africa', '+02:00', 'SAST'),
('Africa/Lagos', 'Lagos, Nigeria', 'Africa', '+01:00', 'WAT'),
('Africa/Nairobi', 'Nairobi, Kenya', 'Africa', '+03:00', 'EAT'),
('Africa/Casablanca', 'Casablanca, Morocco', 'Africa', '+01:00', 'WEST'),
('Africa/Tunis', 'Tunis, Tunisia', 'Africa', '+01:00', 'CET'),
('Africa/Algiers', 'Algiers, Algeria', 'Africa', '+01:00', 'CET'),
('Africa/Accra', 'Accra, Ghana', 'Africa', '+00:00', 'GMT'),
('Africa/Addis_Ababa', 'Addis Ababa, Ethiopia', 'Africa', '+03:00', 'EAT'),
('Africa/Khartoum', 'Khartoum, Sudan', 'Africa', '+02:00', 'CAT'),
('Africa/Dar_es_Salaam', 'Dar es Salaam, Tanzania', 'Africa', '+03:00', 'EAT'),
('Africa/Luanda', 'Luanda, Angola', 'Africa', '+01:00', 'WAT'),

-- Oceania
('Australia/Sydney', 'Sydney, Australia', 'Oceania', '+10:00', 'AEST/AEDT'),
('Australia/Melbourne', 'Melbourne, Australia', 'Oceania', '+10:00', 'AEST/AEDT'),
('Australia/Brisbane', 'Brisbane, Australia', 'Oceania', '+10:00', 'AEST'),
('Australia/Perth', 'Perth, Australia', 'Oceania', '+08:00', 'AWST'),
('Australia/Adelaide', 'Adelaide, Australia', 'Oceania', '+09:30', 'ACST/ACDT'),
('Australia/Darwin', 'Darwin, Australia', 'Oceania', '+09:30', 'ACST'),
('Pacific/Auckland', 'Auckland, New Zealand', 'Oceania', '+12:00', 'NZST/NZDT'),
('Pacific/Fiji', 'Suva, Fiji', 'Oceania', '+12:00', 'FJT'),
('Pacific/Guam', 'Hagatna, Guam', 'Oceania', '+10:00', 'ChST'),
('Pacific/Port_Moresby', 'Port Moresby, Papua New Guinea', 'Oceania', '+10:00', 'PGT'),

-- Atlantic
('Atlantic/Azores', 'Azores, Portugal', 'Atlantic', '-01:00', 'AZOT/AZOST'),
('Atlantic/Canary', 'Canary Islands, Spain', 'Atlantic', '+00:00', 'WET/WEST'),
('Atlantic/Cape_Verde', 'Praia, Cape Verde', 'Atlantic', '-01:00', 'CVT'),
('Atlantic/Reykjavik', 'Reykjavik, Iceland', 'Atlantic', '+00:00', 'GMT'),
('Atlantic/Bermuda', 'Hamilton, Bermuda', 'Atlantic', '-04:00', 'AST/ADT')

ON CONFLICT (code) DO NOTHING;

-- Add comment
COMMENT ON TABLE timezones IS 'Reference table containing all world timezones';
