/**
 * MAKERS POS — Official MAKERS Master Categories (Source of Truth)
 * 
 * 35 Official Main Categories for MAKERS store operations.
 * English names are authoritative and must remain exact.
 */

export interface MakersMasterCategoryDef {
  name_en: string
  name_ar: string
  icon: string
  color: string
  sort_order: number
  description?: string
}

export const MAKERS_MASTER_CATEGORIES: readonly MakersMasterCategoryDef[] = [
  {
    sort_order: 1,
    name_en: 'Aluminum Profile & Shaft',
    name_ar: 'قطاعات وشافت ألومنيوم',
    icon: 'box',
    color: '#64748b',
    description: 'Aluminum profiles, linear shafts, and mounting hardware',
  },
  {
    sort_order: 2,
    name_en: 'Arduino & Development Boards',
    name_ar: 'لوحات أردوينو والتطوير',
    icon: 'cpu',
    color: '#00979d',
    description: 'Arduino boards, ESP microcontrollers, and dev kits',
  },
  {
    sort_order: 3,
    name_en: 'Automotive Electronic Parts',
    name_ar: 'إلكترونيات وقطع غيار السيارات',
    icon: 'car',
    color: '#ef4444',
    description: 'Car electronics, OBD modules, and automotive sensors',
  },
  {
    sort_order: 4,
    name_en: 'Batteries & Chargers & Connectors & Holders',
    name_ar: 'بطاريات وشواحن وحوامل وتوصيلات',
    icon: 'battery-charging',
    color: '#f59e0b',
    description: 'Li-ion, LiPo, battery holders, chargers, and BMS',
  },
  {
    sort_order: 5,
    name_en: 'Breadboards & PCB Boards',
    name_ar: 'بورد تجارب وبوردات مطبوعة (PCB)',
    icon: 'grid',
    color: '#10b981',
    description: 'Prototyping boards, breadboards, copper clad PCBs',
  },
  {
    sort_order: 6,
    name_en: 'Classic Control Components',
    name_ar: 'مكونات التحكم الكلاسيكي والآلي',
    icon: 'sliders',
    color: '#6366f1',
    description: 'Contactors, timers, overloads, and industrial control',
  },
  {
    sort_order: 7,
    name_en: 'CNC & 3D Printer & Mechanical Parts',
    name_ar: 'قطع ماكينات CNC وطابعات 3D وأجزاء ميكانيكية',
    icon: 'printer',
    color: '#8b5cf6',
    description: 'Lead screws, nozzles, belts, pulleys, extruders, bearings',
  },
  {
    sort_order: 8,
    name_en: 'Connectors & Terminals',
    name_ar: 'موصلات وفيش وأطراف توصيل',
    icon: 'link',
    color: '#3b82f6',
    description: 'Headers, terminal blocks, JST, Dupont, screw terminals',
  },
  {
    sort_order: 9,
    name_en: 'Cooling Solutions',
    name_ar: 'حلول التبريد ومراوح',
    icon: 'wind',
    color: '#06b6d4',
    description: 'DC fans, heatsinks, thermal paste, and coolers',
  },
  {
    sort_order: 10,
    name_en: 'Displays',
    name_ar: 'شاشات ووحدات عرض',
    icon: 'monitor',
    color: '#0284c7',
    description: 'OLED, LCD, TFT, 7-Segment, and Nextion displays',
  },
  {
    sort_order: 11,
    name_en: 'Electric Vehicle charger Components',
    name_ar: 'مكونات شواحن السيارات الكهربائية',
    icon: 'zap',
    color: '#14b8a6',
    description: 'EV charging cables, sockets, plugs, and controllers',
  },
  {
    sort_order: 12,
    name_en: 'Electronic Components (SMD)',
    name_ar: 'عناصر إلكترونية سطحية (SMD)',
    icon: 'box',
    color: '#84cc16',
    description: 'SMD resistors, capacitors, transistors, and diodes',
  },
  {
    sort_order: 13,
    name_en: 'Electronic Components (Through-hole)',
    name_ar: 'عناصر إلكترونية ذات أرجل (Through-hole)',
    icon: 'package',
    color: '#eab308',
    description: 'DIP resistors, capacitors, diodes, LEDs, and inductors',
  },
  {
    sort_order: 14,
    name_en: 'Hydraulics & Pneumatics',
    name_ar: 'هيدروليك ونيوماتيك وأنظمة هواء',
    icon: 'droplet',
    color: '#38bdf8',
    description: 'Solenoid valves, cylinders, pneumatic fittings, and pipes',
  },
  {
    sort_order: 15,
    name_en: 'Integrated Circuits (Through-hole)',
    name_ar: 'دوائر متكاملة (ICs Through-hole)',
    icon: 'cpu',
    color: '#a855f7',
    description: 'Logic ICs, op-amps, timers, and DIP microchips',
  },
  {
    sort_order: 16,
    name_en: 'IOT, Wireless & Communication Modules',
    name_ar: 'موديولات إنترنت الأشياء والاتصال اللاسلكي',
    icon: 'wifi',
    color: '#ec4899',
    description: 'WiFi, Bluetooth, LoRa, RF, GSM, GPS, and Zigbee modules',
  },
  {
    sort_order: 17,
    name_en: 'Kits "Packages"',
    name_ar: 'حقائب ومجموعات تعليمية وتطبيقية (Kits)',
    icon: 'package-open',
    color: '#f97316',
    description: 'Starter kits, robotics packages, and learning bundles',
  },
  {
    sort_order: 18,
    name_en: 'Magnets',
    name_ar: 'مغناطيس ومستلزماته',
    icon: 'magnet',
    color: '#d97706',
    description: 'Neodymium magnets, ferrite, and magnetic assemblies',
  },
  {
    sort_order: 19,
    name_en: 'Mobile & Computer Accessories',
    name_ar: 'ملحقات وإكسسوارات الموبايل والكمبيوتر',
    icon: 'smartphone',
    color: '#64748b',
    description: 'Adapters, OTG, cables, hubs, and peripherals',
  },
  {
    sort_order: 20,
    name_en: 'Modules',
    name_ar: 'موديولات ووحدات إلكترونية',
    icon: 'server',
    color: '#3b82f6',
    description: 'Amplifiers, step-up/down breakout boards, RTC, encoders',
  },
  {
    sort_order: 21,
    name_en: 'Motors & Drivers & Wheels',
    name_ar: 'مواتير ودرايفرات وعجلات',
    icon: 'fan',
    color: '#e11d48',
    description: 'Stepper motors, servo motors, DC motors, drivers, and wheels',
  },
  {
    sort_order: 22,
    name_en: 'Photography Gear',
    name_ar: 'معدات وملحقات التصوير',
    icon: 'camera',
    color: '#71717a',
    description: 'Tripods, ring lights, camera mounts, and optical accessories',
  },
  {
    sort_order: 23,
    name_en: 'Power Supply & Converters',
    name_ar: 'محولات ومصادر طاقة وبور سبلاي',
    icon: 'power',
    color: '#eab308',
    description: 'SMPS, power adapters, buck/boost converters, regulators',
  },
  {
    sort_order: 24,
    name_en: 'Relay',
    name_ar: 'ريليهات وقواطع',
    icon: 'toggle-left',
    color: '#10b981',
    description: 'Electromechanical relays, solid state relays (SSR)',
  },
  {
    sort_order: 25,
    name_en: 'Robotics',
    name_ar: 'روبوتكس ومستلزمات الروبوت',
    icon: 'bot',
    color: '#6366f1',
    description: 'Robot chassis, robotic arms, grippers, and accessories',
  },
  {
    sort_order: 26,
    name_en: 'ROV',
    name_ar: 'روبوتات غواصة ومعدات ROV',
    icon: 'anchor',
    color: '#0284c7',
    description: 'Underwater thrusters, watertight enclosures, tether cables',
  },
  {
    sort_order: 27,
    name_en: 'Security Camera',
    name_ar: 'كاميرات ومعدات المراقبة والأمان',
    icon: 'video',
    color: '#475569',
    description: 'CCTV cameras, IP cameras, lenses, DVR/NVR accessories',
  },
  {
    sort_order: 28,
    name_en: 'Sensors',
    name_ar: 'حساسات ومستشعرات',
    icon: 'activity',
    color: '#f59e0b',
    description: 'Temperature, ultrasonic, motion, gas, light, and pressure sensors',
  },
  {
    sort_order: 29,
    name_en: 'Solar',
    name_ar: 'طاقة شمسية ومكوناتها',
    icon: 'sun',
    color: '#facc15',
    description: 'Solar panels, solar charge controllers, PV accessories',
  },
  {
    sort_order: 30,
    name_en: 'Speakers',
    name_ar: 'سماعات ومكبرات صوت',
    icon: 'volume-2',
    color: '#8b5cf6',
    description: 'Buzzers, micro speakers, audio drivers, and horns',
  },
  {
    sort_order: 31,
    name_en: 'Sterilization Equipment And Accessories (COVID-19)',
    name_ar: 'أجهزة ومستلزمات التعقيم',
    icon: 'shield-check',
    color: '#14b8a6',
    description: 'UV sterilizers, sanitizer dispensers, and protection modules',
  },
  {
    sort_order: 32,
    name_en: 'Switches',
    name_ar: 'مفاتيح وسويتشات وأزرار',
    icon: 'toggle-right',
    color: '#0ea5e9',
    description: 'Push buttons, rocker switches, toggle switches, limit switches',
  },
  {
    sort_order: 33,
    name_en: 'Tape',
    name_ar: 'أشرطة ولاصق وعوازل',
    icon: 'file-text',
    color: '#78716c',
    description: 'Kapton tape, electrical tape, thermal tape, double sided tape',
  },
  {
    sort_order: 34,
    name_en: 'Tools & Measurements',
    name_ar: 'أدوات وعدد وأجهزة قياس',
    icon: 'wrench',
    color: '#f97316',
    description: 'Multimeters, soldering irons, pliers, calipers, screwdrivers',
  },
  {
    sort_order: 35,
    name_en: 'Wires & Cables & Heat Shrink',
    name_ar: 'أسلاك وكابلات وشرينك حراري',
    icon: 'cable',
    color: '#6b7280',
    description: 'Silicone wires, ribbon cables, heat shrink tubes, jumpers',
  },
] as const

/**
 * Safe string normalization helper for case-insensitive and whitespace-tolerant matching.
 */
export function normalizeCategoryName(name: string): string {
  return (name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}
