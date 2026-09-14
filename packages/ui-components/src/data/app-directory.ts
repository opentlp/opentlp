export interface CompanionAppInfo {
    id: string;
    name: string;
    developer: string;
    brandColor: string;
    brandPalette: string[];
    badgeLetter: string;
    popularModels: string[];
    summary: string;
    replacesApps: string[];
    isMultiDevice?: boolean;
    playStoreUrl?: string;
    appStoreUrl?: string;
}

export const KNOWN_COMPANION_APPS: CompanionAppInfo[] = [
    {
        id: 'pocket_printer',
        name: 'Pocket Printer',
        developer: 'Karsten International B.V.',
        brandColor: '#0068a0',
        brandPalette: ['#0068a0', '#284cc8', '#ffffff'],
        badgeLetter: 'P',
        popularModels: ['L13', 'DP-L13', 'SilverCrest', 'Crafts&Co', 'Fichero'],
        summary: 'European retail pocket and label printers (Action, Lidl SilverCrest, Crafts&Co). Supports both Pocket Printer (58mm) and Label Printer (L13) protocols.',
        replacesApps: ['Pocket Printer', 'Pocket Print'],
        isMultiDevice: true,
        playStoreUrl: 'https://play.google.com/store/apps/details?id=com.printer.lidloffice',
        appStoreUrl: 'https://apps.apple.com/app/pocket-printer/id1534948842'
    },
    {
        id: 'marklife',
        name: 'Marklife',
        developer: 'Marklife / Zhuhai Quin',
        brandColor: '#fb4e48',
        brandPalette: ['#fb4e48', '#ffffff'],
        badgeLetter: 'M',
        popularModels: ['P12', 'P11', 'P15', 'P50', 'M1'],
        summary: 'Compact thermal tape and die-cut label makers using the Marklife 0x1F protocol.',
        replacesApps: ['Marklife'],
        playStoreUrl: 'https://play.google.com/store/apps/details?id=com.quyin.marklife',
        appStoreUrl: 'https://apps.apple.com/app/marklife/id1552317937'
    },
    {
        id: 'tiny_print',
        name: 'Tiny Print',
        developer: 'Tiny Print / iPrint Team',
        brandColor: '#5cc4f8',
        brandPalette: ['#5cc4f8', '#7870e0', '#ffffff'],
        badgeLetter: 'T',
        popularModels: ['GB01', 'MX05', 'MX06', 'MX08', 'MX10', 'YT01'],
        summary: 'Ubiquitous 58mm cat and teddy bear continuous thermal pocket printers (0x51/0x78 Tiny protocol).',
        replacesApps: ['Tiny Print', 'iPrint'],
        playStoreUrl: 'https://play.google.com/store/apps/details?id=com.frogtosea.tinyPrint',
        appStoreUrl: 'https://apps.apple.com/app/tiny-print/id1593356064'
    },
    {
        id: 'niimbot',
        name: 'NIIMBOT',
        developer: 'Wuhan Jingchen Intelligent Identification',
        brandColor: '#fc4840',
        brandPalette: ['#fc4840', '#b6b6b6', '#ffffff'],
        badgeLetter: 'N',
        popularModels: ['D11', 'D110', 'B21', 'B1', 'D101', 'B3S'],
        summary: 'Smart thermal label makers using smart RFID/die-cut labels and Niimbot protocol.',
        replacesApps: ['NIIMBOT'],
        playStoreUrl: 'https://play.google.com/store/apps/details?id=com.gengcon.android.jccloudprinter',
        appStoreUrl: 'https://apps.apple.com/app/niimbot/id1438992019'
    },
    {
        id: 'print_master',
        name: 'Print Master',
        developer: 'AIMO Tech / Zhuhai Quin',
        brandColor: '#e53a38',
        brandPalette: ['#e53a38', '#ffffff'],
        badgeLetter: 'P',
        popularModels: ['M110', 'M220', 'D30', 'M120', 'Q30'],
        summary: 'Official app for portable Phomemo/AIMO die-cut label makers.',
        replacesApps: ['Print Master', 'Phomemo'],
        playStoreUrl: 'https://play.google.com/store/apps/details?id=com.project.aimotech.printmaster',
        appStoreUrl: 'https://apps.apple.com/app/print-master/id1527497184'
    },
    {
        id: 'phomemo',
        name: 'Phomemo',
        developer: 'Zhuhai Quin Technology Co., Ltd.',
        brandColor: '#fe677c',
        brandPalette: ['#fe677c', '#fc3f54', '#ffffff'],
        badgeLetter: 'P',
        popularModels: ['M02', 'M04', 'T02', 'M02S', 'M110'],
        summary: 'Popular thermal printers spanning portable pocket note printers (M02) and versatile label printers.',
        replacesApps: ['Phomemo', 'Print Master'],
        isMultiDevice: true,
        playStoreUrl: 'https://play.google.com/store/apps/details?id=com.quyin.phomemo',
        appStoreUrl: 'https://apps.apple.com/app/phomemo/id1437197177'
    },
    {
        id: 'fun_print',
        name: 'Fun Print',
        developer: 'Fun Print / Funny Print Team',
        brandColor: '#f95959',
        brandPalette: ['#f95959', '#ffffff'],
        badgeLetter: 'F',
        popularModels: ['BH-01', 'LX-D01', 'LX-D02', 'LX-D09'],
        summary: 'Mini thermal memo and sticker printers running the Funny Print LX-D raster protocol.',
        replacesApps: ['Fun Print', 'Funny Print'],
        playStoreUrl: 'https://play.google.com/store/apps/details?id=com.yintibao.funprint',
        appStoreUrl: 'https://apps.apple.com/app/fun-print/id1588661642'
    },
    {
        id: 'walkprint',
        name: 'WalkPrint',
        developer: 'WalkPrint / efercro Team',
        brandColor: '#8073f7',
        brandPalette: ['#8073f7', '#ffffff'],
        badgeLetter: 'W',
        popularModels: ['MXW01', 'V5G', 'MX05', 'Luck Jingle'],
        summary: 'Portable thermal pocket and receipt printers using WalkPrint / V5X bulk raster protocol.',
        replacesApps: ['WalkPrint', 'Luck Jingle'],
        playStoreUrl: 'https://play.google.com/store/apps/details?id=com.yhk.rabbit.print.walkprint',
        appStoreUrl: 'https://apps.apple.com/app/walkprint/id1530932269'
    },
    {
        id: 'peripage',
        name: 'PeriPage',
        developer: 'Xiamen iLead Tek Co., Ltd.',
        brandColor: '#3fad34',
        brandPalette: ['#3fad34', '#ffffff', '#332d2b'],
        badgeLetter: 'P',
        popularModels: ['A6', 'A9', 'C6', 'A8', 'A6+'],
        summary: 'Bear-styled 58mm and 80mm pocket printers using standard ESC/POS raster framing.',
        replacesApps: ['PeriPage'],
        playStoreUrl: 'https://play.google.com/store/apps/details?id=com.ileadtek.peripage',
        appStoreUrl: 'https://apps.apple.com/app/peripage/id1391583095'
    },
    {
        id: 'flashlabel',
        name: 'FlashLabel',
        developer: 'Xiamen Angyin Information Technology',
        brandColor: '#1d5a9d',
        brandPalette: ['#1d5a9d', '#429afd', '#ffffff'],
        badgeLetter: 'O',
        popularModels: ['Orgsta S001', 'Y486', 'A318'],
        summary: 'Desktop shipping and thermal barcode printers using TSPL/CPCL protocol.',
        replacesApps: ['FlashLabel', 'Orgsta'],
        playStoreUrl: 'https://play.google.com/store/apps/details?id=cn.angyin.flashlabel',
        appStoreUrl: 'https://apps.apple.com/app/flashlabel/id1532938883'
    },
    {
        id: 'labelife',
        name: 'Labelife',
        developer: 'AIMO Tech / Zhuhai Quin',
        brandColor: '#3d81f8',
        brandPalette: ['#3d81f8', '#ffffff'],
        badgeLetter: 'L',
        popularModels: ['PM-241', 'PM-241BT', 'D520'],
        summary: 'Wide desktop commercial shipping label printers communicating via TSPL commands.',
        replacesApps: ['Labelife', 'Phomemo'],
        playStoreUrl: 'https://play.google.com/store/apps/details?id=com.aimo.labelife',
        appStoreUrl: 'https://apps.apple.com/app/labelife/id1562947230'
    },
    {
        id: 'munbyn_print',
        name: 'Munbyn Print',
        developer: 'MUNBYN / SYZ',
        brandColor: '#ff4713',
        brandPalette: ['#ff4713', '#ffffff'],
        badgeLetter: 'M',
        popularModels: ['ITPP941', 'RW401AP', 'Realwriter 941', 'ITPP130'],
        summary: 'Commercial shipping and thermal barcode label printers using TSPL/CPCL protocol.',
        replacesApps: ['Munbyn Print', 'Munbyn'],
        playStoreUrl: 'https://play.google.com/store/apps/details?id=com.syz.mprint',
        appStoreUrl: 'https://apps.apple.com/app/munbyn-print/id1588636254'
    }
];
