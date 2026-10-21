// Géographie pour la carte des lauréats : coordonnées des villes, centroïdes des pays,
// noms de pays canoniques (français) et leur traduction arabe. Aucune dépendance.

// Pays : [code, nom canonique, nom arabe, lat, lng, alias séparés par |]
const PAYS = [
  ['MA', 'Maroc', 'المغرب', 31.79, -7.09, 'morocco|marokko|al maghrib|royaume du maroc'],
  ['FR', 'France', 'فرنسا', 46.23, 2.21, 'republique francaise|french republic'],
  ['DE', 'Allemagne', 'ألمانيا', 51.17, 10.45, 'germany|deutschland'],
  ['CA', 'Canada', 'كندا', 56.13, -106.35, 'kanada'],
  ['BE', 'Belgique', 'بلجيكا', 50.5, 4.47, 'belgium|belgie|belgien'],
  ['CH', 'Suisse', 'سويسرا', 46.82, 8.23, 'switzerland|schweiz|svizzera'],
  ['ES', 'Espagne', 'إسبانيا', 40.46, -3.75, 'spain|espana'],
  ['IT', 'Italie', 'إيطاليا', 41.87, 12.57, 'italy|italia'],
  ['NL', 'Pays-Bas', 'هولندا', 52.13, 5.29, 'netherlands|the netherlands|nederland|holland|hollande'],
  ['GB', 'Royaume-Uni', 'المملكة المتحدة', 55.38, -3.44, 'uk|u k|united kingdom|great britain|grande bretagne|britain|angleterre|england|ecosse|scotland|wales'],
  ['IE', 'Irlande', 'أيرلندا', 53.41, -8.24, 'ireland|eire'],
  ['PT', 'Portugal', 'البرتغال', 39.4, -8.22, ''],
  ['LU', 'Luxembourg', 'لوكسمبورغ', 49.82, 6.13, 'luxemburg'],
  ['SE', 'Suède', 'السويد', 60.13, 18.64, 'sweden|sverige'],
  ['NO', 'Norvège', 'النرويج', 60.47, 8.47, 'norway|norge'],
  ['DK', 'Danemark', 'الدنمارك', 56.26, 9.5, 'denmark|danmark'],
  ['FI', 'Finlande', 'فنلندا', 61.92, 25.75, 'finland|suomi'],
  ['AT', 'Autriche', 'النمسا', 47.52, 14.55, 'austria|osterreich|oesterreich'],
  ['PL', 'Pologne', 'بولندا', 51.92, 19.15, 'poland|polska'],
  ['CZ', 'République tchèque', 'التشيك', 49.82, 15.47, 'czech republic|czechia|tchequie'],
  ['HU', 'Hongrie', 'المجر', 47.16, 19.5, 'hungary'],
  ['RO', 'Roumanie', 'رومانيا', 45.94, 24.97, 'romania'],
  ['GR', 'Grèce', 'اليونان', 39.07, 21.82, 'greece'],
  ['MT', 'Malte', 'مالطا', 35.94, 14.38, 'malta'],
  ['MC', 'Monaco', 'موناكو', 43.75, 7.41, ''],
  ['RU', 'Russie', 'روسيا', 61.52, 105.32, 'russia'],
  ['TR', 'Turquie', 'تركيا', 38.96, 35.24, 'turkey|turkiye'],
  ['US', 'États-Unis', 'الولايات المتحدة', 37.09, -95.71, 'usa|us|u s a|u s|united states|united states of america|etats unis d amerique|amerique|america|eua'],
  ['MX', 'Mexique', 'المكسيك', 23.63, -102.55, 'mexico'],
  ['BR', 'Brésil', 'البرازيل', -14.24, -51.93, 'brazil|brasil'],
  ['AR', 'Argentine', 'الأرجنتين', -38.42, -63.62, 'argentina'],
  ['CL', 'Chili', 'تشيلي', -35.68, -71.54, 'chile'],
  ['CO', 'Colombie', 'كولومبيا', 4.57, -74.3, 'colombia'],
  ['AE', 'Émirats arabes unis', 'الإمارات العربية المتحدة', 23.42, 53.85, 'uae|u a e|eau|e a u|emirats|emirates|united arab emirates|emirats arabes|الإمارات'],
  ['QA', 'Qatar', 'قطر', 25.35, 51.18, 'katar'],
  ['SA', 'Arabie saoudite', 'السعودية', 23.89, 45.08, 'saudi arabia|saudi|ksa|arabie|المملكة العربية السعودية'],
  ['KW', 'Koweït', 'الكويت', 29.31, 47.48, 'kuwait'],
  ['BH', 'Bahreïn', 'البحرين', 25.93, 50.64, 'bahrain'],
  ['OM', 'Oman', 'عُمان', 21.51, 55.92, 'sultanat d oman'],
  ['JO', 'Jordanie', 'الأردن', 30.59, 36.24, 'jordan'],
  ['LB', 'Liban', 'لبنان', 33.85, 35.86, 'lebanon'],
  ['EG', 'Égypte', 'مصر', 26.82, 30.8, 'egypt'],
  ['TN', 'Tunisie', 'تونس', 33.89, 9.54, 'tunisia'],
  ['DZ', 'Algérie', 'الجزائر', 28.03, 1.66, 'algeria'],
  ['LY', 'Libye', 'ليبيا', 26.34, 17.23, 'libya'],
  ['MR', 'Mauritanie', 'موريتانيا', 21.01, -10.94, 'mauritania'],
  ['SN', 'Sénégal', 'السنغال', 14.5, -14.45, 'senegal'],
  ['ML', 'Mali', 'مالي', 17.57, -4, ''],
  ['CI', 'Côte d’Ivoire', 'ساحل العاج', 7.54, -5.55, 'ivory coast|cote divoire|rci'],
  ['BF', 'Burkina Faso', 'بوركينا فاسو', 12.24, -1.56, 'burkina'],
  ['NE', 'Niger', 'النيجر', 17.61, 8.08, ''],
  ['GN', 'Guinée', 'غينيا', 9.95, -9.7, 'guinea|guinee conakry'],
  ['CM', 'Cameroun', 'الكاميرون', 7.37, 12.35, 'cameroon'],
  ['GA', 'Gabon', 'الغابون', -0.8, 11.61, ''],
  ['NG', 'Nigeria', 'نيجيريا', 9.08, 8.68, ''],
  ['GH', 'Ghana', 'غانا', 7.95, -1.02, ''],
  ['BJ', 'Bénin', 'بنين', 9.31, 2.32, 'benin'],
  ['TG', 'Togo', 'توغو', 8.62, 0.82, ''],
  ['CD', 'République démocratique du Congo', 'جمهورية الكونغو الديمقراطية', -4.04, 21.76, 'rdc|drc|rd congo|dr congo|congo kinshasa|democratic republic of the congo'],
  ['KE', 'Kenya', 'كينيا', -0.02, 37.91, ''],
  ['ET', 'Éthiopie', 'إثيوبيا', 9.15, 40.49, 'ethiopia'],
  ['ZA', 'Afrique du Sud', 'جنوب أفريقيا', -30.56, 22.94, 'south africa'],
  ['RW', 'Rwanda', 'رواندا', -1.94, 29.87, ''],
  ['DJ', 'Djibouti', 'جيبوتي', 11.83, 42.59, ''],
  ['CN', 'Chine', 'الصين', 35.86, 104.2, 'china|prc'],
  ['JP', 'Japon', 'اليابان', 36.2, 138.25, 'japan'],
  ['KR', 'Corée du Sud', 'كوريا الجنوبية', 35.91, 127.77, 'south korea|korea|coree'],
  ['IN', 'Inde', 'الهند', 20.59, 78.96, 'india'],
  ['SG', 'Singapour', 'سنغافورة', 1.35, 103.82, 'singapore'],
  ['MY', 'Malaisie', 'ماليزيا', 4.21, 101.98, 'malaysia'],
  ['ID', 'Indonésie', 'إندونيسيا', -0.79, 113.92, 'indonesia'],
  ['VN', 'Vietnam', 'فيتنام', 14.06, 108.28, 'viet nam'],
  ['TH', 'Thaïlande', 'تايلاند', 15.87, 100.99, 'thailand'],
  ['AU', 'Australie', 'أستراليا', -25.27, 133.78, 'australia'],
  ['NZ', 'Nouvelle-Zélande', 'نيوزيلندا', -40.9, 174.89, 'new zealand'],
];

// Villes : [nom canonique, lat, lng, code pays, alias séparés par |]
const VILLES = [
  // Maroc, zones industrielles comprises
  ['Casablanca', 33.57, -7.59, 'MA', 'casa|dar el beida|الدار البيضاء|كازا'],
  ['Rabat', 34.02, -6.84, 'MA', 'الرباط|technopolis'],
  ['Salé', 34.05, -6.8, 'MA', 'sla|سلا'],
  ['Témara', 33.93, -6.91, 'MA', 'تمارة'],
  ['Skhirat', 33.85, -7.03, 'MA', ''],
  ['Bouznika', 33.79, -7.16, 'MA', ''],
  ['Mohammedia', 33.69, -7.38, 'MA', 'المحمدية'],
  ['Bouskoura', 33.45, -7.65, 'MA', 'casanearshore|casa nearshore'],
  ['Nouaceur', 33.37, -7.58, 'MA', 'midparc|mid parc|aeroport mohammed v'],
  ['Tit Mellil', 33.56, -7.48, 'MA', 'titmellil'],
  ['Had Soualem', 33.42, -7.85, 'MA', ''],
  ['Berrechid', 33.27, -7.58, 'MA', 'برشيد'],
  ['Settat', 33, -7.62, 'MA', 'سطات'],
  ['El Jadida', 33.25, -8.51, 'MA', 'jadida|الجديدة'],
  ['Jorf Lasfar', 33.11, -8.64, 'MA', 'jorf|jorf el asfar|jorf al asfar|الجرف الأصفر'],
  ['Safi', 32.3, -9.24, 'MA', 'asfi|آسفي'],
  ['Youssoufia', 32.25, -8.53, 'MA', ''],
  ['Benguerir', 32.24, -7.95, 'MA', 'ben guerir|ben grir|bengrir|ابن جرير'],
  ['Khouribga', 32.88, -6.91, 'MA', 'خريبكة'],
  ['Béni Mellal', 32.34, -6.36, 'MA', 'بني ملال'],
  ['Khénifra', 32.94, -5.67, 'MA', ''],
  ['Kénitra', 34.26, -6.58, 'MA', 'atlantic free zone|kenitra atlantic free zone|afz|القنيطرة'],
  ['Sidi Kacem', 34.22, -5.71, 'MA', ''],
  ['Sidi Slimane', 34.26, -5.93, 'MA', ''],
  ['Khémisset', 33.82, -6.07, 'MA', ''],
  ['Meknès', 33.89, -5.55, 'MA', 'مكناس'],
  ['Fès', 34.03, -5, 'MA', 'fez|فاس'],
  ['Ifrane', 33.53, -5.11, 'MA', 'إفران'],
  ['Azrou', 33.43, -5.22, 'MA', ''],
  ['Taza', 34.21, -4.01, 'MA', 'تازة'],
  ['Tanger', 35.76, -5.83, 'MA', 'tangier|tangiers|tanja|طنجة|tanger automotive city'],
  ['Tanger Med', 35.89, -5.5, 'MA', 'tangermed|port tanger med|melloussa|ksar sghir|طنجة المتوسط'],
  ['Tétouan', 35.57, -5.37, 'MA', 'tetuan|تطوان|tetouan shore'],
  ['Martil', 35.62, -5.28, 'MA', ''],
  ['Fnideq', 35.85, -5.36, 'MA', ''],
  ['Larache', 35.19, -6.16, 'MA', 'العرائش'],
  ['Ksar El Kébir', 35, -5.9, 'MA', 'ksar kebir'],
  ['Chefchaouen', 35.17, -5.27, 'MA', 'chaouen'],
  ['Al Hoceïma', 35.25, -3.93, 'MA', 'alhoceima|hoceima|الحسيمة'],
  ['Nador', 35.17, -2.93, 'MA', 'nador west med|الناظور'],
  ['Berkane', 34.92, -2.32, 'MA', 'بركان'],
  ['Oujda', 34.68, -1.91, 'MA', 'وجدة'],
  ['Taourirt', 34.41, -2.9, 'MA', ''],
  ['Midelt', 32.68, -4.74, 'MA', ''],
  ['Errachidia', 31.93, -4.43, 'MA', 'er rachidia|rachidia|الرشيدية'],
  ['Ouarzazate', 30.92, -6.89, 'MA', 'noor ouarzazate|ورزازات'],
  ['Marrakech', 31.63, -8.01, 'MA', 'marrakesh|مراكش'],
  ['Essaouira', 31.51, -9.77, 'MA', 'mogador|الصويرة'],
  ['Agadir', 30.43, -9.6, 'MA', 'أكادير'],
  ['Inezgane', 30.36, -9.54, 'MA', ''],
  ['Aït Melloul', 30.33, -9.5, 'MA', ''],
  ['Taroudant', 30.47, -8.88, 'MA', ''],
  ['Tiznit', 29.7, -9.73, 'MA', ''],
  ['Guelmim', 28.99, -10.06, 'MA', ''],
  ['Laâyoune', 27.15, -13.2, 'MA', 'layoune|el aaiun|العيون'],
  ['Dakhla', 23.68, -15.96, 'MA', 'الداخلة'],
  // Europe
  ['Paris', 48.86, 2.35, 'FR', 'la defense|ile de france|idf|saclay|paris saclay|باريس'],
  ['Lyon', 45.76, 4.84, 'FR', ''],
  ['Marseille', 43.3, 5.37, 'FR', ''],
  ['Toulouse', 43.6, 1.44, 'FR', ''],
  ['Bordeaux', 44.84, -0.58, 'FR', ''],
  ['Lille', 50.63, 3.06, 'FR', ''],
  ['Nantes', 47.22, -1.55, 'FR', ''],
  ['Strasbourg', 48.57, 7.75, 'FR', ''],
  ['Grenoble', 45.19, 5.72, 'FR', ''],
  ['Montpellier', 43.61, 3.88, 'FR', ''],
  ['Nice', 43.7, 7.27, 'FR', 'sophia antipolis'],
  ['Rennes', 48.11, -1.68, 'FR', ''],
  ['Metz', 49.12, 6.18, 'FR', ''],
  ['Angers', 47.47, -0.55, 'FR', ''],
  ['Aix-en-Provence', 43.53, 5.45, 'FR', 'aix'],
  ['Clermont-Ferrand', 45.78, 3.08, 'FR', ''],
  ['Berlin', 52.52, 13.4, 'DE', ''],
  ['Munich', 48.14, 11.58, 'DE', 'munchen|muenchen'],
  ['Hambourg', 53.55, 9.99, 'DE', 'hamburg'],
  ['Francfort', 50.11, 8.68, 'DE', 'frankfurt|frankfurt am main|francfort sur le main'],
  ['Stuttgart', 48.78, 9.18, 'DE', ''],
  ['Cologne', 50.94, 6.96, 'DE', 'koln|koeln'],
  ['Düsseldorf', 51.23, 6.77, 'DE', 'duesseldorf'],
  ['Aix-la-Chapelle', 50.78, 6.08, 'DE', 'aachen'],
  ['Karlsruhe', 49.01, 8.4, 'DE', ''],
  ['Wolfsburg', 52.42, 10.79, 'DE', ''],
  ['Bruxelles', 50.85, 4.35, 'BE', 'brussels|brussel'],
  ['Liège', 50.63, 5.57, 'BE', ''],
  ['Anvers', 51.22, 4.4, 'BE', 'antwerp|antwerpen'],
  ['Gand', 51.05, 3.72, 'BE', 'gent|ghent'],
  ['Louvain-la-Neuve', 50.67, 4.61, 'BE', 'lln'],
  ['Genève', 46.2, 6.14, 'CH', 'geneva|genf'],
  ['Zurich', 47.38, 8.54, 'CH', ''],
  ['Lausanne', 46.52, 6.63, 'CH', ''],
  ['Bâle', 47.56, 7.59, 'CH', 'basel'],
  ['Madrid', 40.42, -3.7, 'ES', ''],
  ['Barcelone', 41.39, 2.17, 'ES', 'barcelona'],
  ['Valencia', 39.47, -0.38, 'ES', ''],
  ['Séville', 37.39, -5.98, 'ES', 'sevilla'],
  ['Bilbao', 43.26, -2.93, 'ES', ''],
  ['Rome', 41.9, 12.5, 'IT', 'roma'],
  ['Milan', 45.46, 9.19, 'IT', 'milano'],
  ['Turin', 45.07, 7.69, 'IT', 'torino'],
  ['Bologne', 44.49, 11.34, 'IT', 'bologna'],
  ['Amsterdam', 52.37, 4.9, 'NL', ''],
  ['Rotterdam', 51.92, 4.48, 'NL', ''],
  ['La Haye', 52.08, 4.3, 'NL', 'the hague|den haag'],
  ['Eindhoven', 51.44, 5.47, 'NL', ''],
  ['Londres', 51.51, -0.13, 'GB', 'london'],
  ['Manchester', 53.48, -2.24, 'GB', ''],
  ['Birmingham', 52.49, -1.89, 'GB', ''],
  ['Édimbourg', 55.95, -3.19, 'GB', 'edinburgh'],
  ['Cambridge', 52.21, 0.12, 'GB', ''],
  ['Dublin', 53.35, -6.26, 'IE', ''],
  ['Lisbonne', 38.72, -9.14, 'PT', 'lisbon|lisboa'],
  ['Porto', 41.15, -8.61, 'PT', 'oporto'],
  ['Luxembourg', 49.61, 6.13, 'LU', ''],
  ['Stockholm', 59.33, 18.07, 'SE', ''],
  ['Göteborg', 57.71, 11.97, 'SE', 'gothenburg'],
  ['Vienne', 48.21, 16.37, 'AT', 'vienna|wien'],
  ['Varsovie', 52.23, 21.01, 'PL', 'warsaw|warszawa'],
  ['Prague', 50.08, 14.44, 'CZ', 'praha'],
  ['Copenhague', 55.68, 12.57, 'DK', 'copenhagen|kobenhavn'],
  ['Oslo', 59.91, 10.75, 'NO', ''],
  ['Helsinki', 60.17, 24.94, 'FI', ''],
  // Amérique du Nord et du Sud
  ['Montréal', 45.5, -73.57, 'CA', 'mtl'],
  ['Québec', 46.81, -71.21, 'CA', ''],
  ['Ottawa', 45.42, -75.7, 'CA', ''],
  ['Toronto', 43.65, -79.38, 'CA', ''],
  ['Vancouver', 49.28, -123.12, 'CA', ''],
  ['Calgary', 51.05, -114.07, 'CA', ''],
  ['Sherbrooke', 45.4, -71.89, 'CA', ''],
  ['New York', 40.71, -74.01, 'US', 'nyc|manhattan'],
  ['San Francisco', 37.77, -122.42, 'US', 'sf|bay area|silicon valley|san jose'],
  ['Los Angeles', 34.05, -118.24, 'US', ''],
  ['Seattle', 47.61, -122.33, 'US', ''],
  ['Boston', 42.36, -71.06, 'US', ''],
  ['Chicago', 41.88, -87.63, 'US', ''],
  ['Houston', 29.76, -95.37, 'US', ''],
  ['Detroit', 42.33, -83.05, 'US', ''],
  ['Washington', 38.91, -77.04, 'US', 'washington dc|dc'],
  ['Mexico', 19.43, -99.13, 'MX', 'ciudad de mexico'],
  ['São Paulo', -23.55, -46.63, 'BR', ''],
  // Golfe, Moyen-Orient, Asie, Océanie
  ['Dubaï', 25.2, 55.27, 'AE', 'dubai|دبي'],
  ['Abou Dabi', 24.45, 54.38, 'AE', 'abu dhabi|abou dhabi|abudhabi|أبوظبي'],
  ['Doha', 25.29, 51.53, 'QA', 'الدوحة'],
  ['Riyad', 24.71, 46.68, 'SA', 'riyadh|الرياض'],
  ['Djeddah', 21.49, 39.19, 'SA', 'jeddah|jedda|جدة'],
  ['Dammam', 26.43, 50.1, 'SA', 'dhahran|al khobar|khobar'],
  ['Jubail', 27.01, 49.66, 'SA', 'al jubail'],
  ['Koweït', 29.38, 47.99, 'KW', 'kuwait|koweit city'],
  ['Manama', 26.23, 50.59, 'BH', ''],
  ['Mascate', 23.59, 58.41, 'OM', 'muscat'],
  ['Amman', 31.95, 35.93, 'JO', ''],
  ['Beyrouth', 33.89, 35.5, 'LB', 'beirut'],
  ['Istanbul', 41.01, 28.98, 'TR', ''],
  ['Ankara', 39.93, 32.86, 'TR', ''],
  ['Pékin', 39.9, 116.41, 'CN', 'beijing'],
  ['Shanghai', 31.23, 121.47, 'CN', ''],
  ['Shenzhen', 22.54, 114.06, 'CN', ''],
  ['Hong Kong', 22.32, 114.17, 'CN', ''],
  ['Tokyo', 35.68, 139.69, 'JP', ''],
  ['Osaka', 34.69, 135.5, 'JP', ''],
  ['Séoul', 37.57, 126.98, 'KR', ''],
  ['Bangalore', 12.97, 77.59, 'IN', 'bengaluru'],
  ['Singapour', 1.35, 103.82, 'SG', 'singapore'],
  ['Kuala Lumpur', 3.14, 101.69, 'MY', ''],
  ['Sydney', -33.87, 151.21, 'AU', ''],
  // Afrique
  ['Dakar', 14.72, -17.47, 'SN', ''],
  ['Abidjan', 5.36, -4.01, 'CI', ''],
  ['Tunis', 36.81, 10.18, 'TN', ''],
  ['Sfax', 34.74, 10.76, 'TN', ''],
  ['Alger', 36.75, 3.06, 'DZ', 'algiers'],
  ['Le Caire', 30.04, 31.24, 'EG', 'cairo|caire|القاهرة'],
  ['Nouakchott', 18.08, -15.98, 'MR', ''],
  ['Bamako', 12.64, -8, 'ML', ''],
  ['Ouagadougou', 12.37, -1.53, 'BF', ''],
  ['Douala', 4.05, 9.77, 'CM', ''],
  ['Libreville', 0.42, 9.47, 'GA', ''],
  ['Lagos', 6.52, 3.38, 'NG', ''],
  ['Nairobi', -1.29, 36.82, 'KE', ''],
  ['Johannesburg', -26.2, 28.05, 'ZA', ''],
  ['Kigali', -1.95, 30.06, 'RW', ''],
];

// Normalise un nom de lieu : minuscules, sans accents ni ponctuation, sans « ville de », « grand »…
export function normGeo(s) {
  return String(s ?? '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f\u064b-\u065f\u0670]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
    .replace(/^(?:(?:ville|city|province|prefecture|wilaya|region|commune|grand|greater|zone industrielle|zone franche|zi)(?: (?:de|du|des|d|of|la|l))* )+/, '')
    .replace(/ (?:ville|city|centre|center)$/, '');
}

const CODE = new Map(PAYS.map(p => [p[0], p]));
const byPays = new Map(), byVille = new Map();
const add = (m, k, e) => { k = normGeo(k); if (k && !m.has(k)) m.set(k, e); };
for (const p of PAYS) for (const a of [p[1], p[2], ...p[5].split('|')]) add(byPays, a, p);
for (const v of VILLES) for (const a of [v[0], ...v[4].split('|')]) add(byVille, a, v);

// Nom arabe de chaque pays canonique
export const PAYS_AR = Object.fromEntries(PAYS.map(p => [p[1], p[2]]));

// Nom canonique d'un pays connu, sinon null
export function paysOf(s) { return byPays.get(normGeo(s))?.[1] || null; }
// Nom canonique (français) d'un pays, ou la saisie nettoyée si le pays est inconnu
export function canonPays(s) { return paysOf(s) || String(s ?? '').trim(); }
export function countryCentroid(pays) { const p = byPays.get(normGeo(pays)); return p ? [p[3], p[4]] : null; }

const villeRow = v => v && { ville: v[0], pays: CODE.get(v[3])[1], coords: [v[1], v[2]] };
// Ville connue (nom ou alias exact) : { ville, pays, coords } ou null
export function lookupVille(s) { return villeRow(byVille.get(normGeo(s))) || null; }

// Cherche une ville dans une saisie libre (« Zone franche de Kénitra », « Casablanca, Maroc »)
function findVille(s) {
  const n = normGeo(s); if (!n) return null;
  if (byVille.has(n)) return villeRow(byVille.get(n));
  const t = n.split(' ');
  for (let len = Math.min(4, t.length); len >= 1; len--) {
    for (let i = 0; i + len <= t.length; i++) {
      const k = t.slice(i, i + len).join(' ');
      if (len === 1 && k.length < 3) continue;
      if (byVille.has(k)) return villeRow(byVille.get(k));
    }
  }
  return null;
}

// [lat, lng] d'un lieu : la ville si elle est connue (et cohérente avec le pays), sinon le centre du pays
export function coordsOf(ville, pays) {
  try {
    const v = findVille(ville), p = paysOf(pays);
    if (v && (!p || p === 'Maroc' || p === v.pays)) return v.coords;
    return countryCentroid(pays) || (v ? v.coords : countryCentroid(ville));
  } catch { return null; }
}
