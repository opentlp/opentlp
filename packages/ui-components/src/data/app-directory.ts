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
        appStoreUrl: 'https://apps.apple.com/app/pocket-printer/id6444190726'
    },
    {
        id: 'marklife',
        name: 'Marklife',
        developer: 'Marklife / Zhuhai Quin',
        brandColor: '#fb4e48',
        brandPalette: ['#ffffff', '#fb4e48'],
        badgeLetter: 'M',
        popularModels: ['P12', 'P11', 'P15', 'P50', 'M1'],
        summary: 'Compact thermal tape and die-cut label makers using the Marklife 0x1F protocol.',
        replacesApps: ['Marklife'],
        playStoreUrl: 'https://play.google.com/store/apps/details?id=com.feioou.deliprint.yxq',
        appStoreUrl: 'https://apps.apple.com/app/marklife/id1540535142'
    },
    {
        id: 'tiny_print',
        name: 'Tiny Print',
        developer: 'Tiny Print / iPrint Team',
        brandColor: '#5cc4f8',
        brandPalette: ['#ffffff', '#5cc4f8', '#7870e0'],
        badgeLetter: 'T',
        popularModels: ['GB01', 'MX05', 'MX06', 'MX08', 'MX10', 'YT01'],
        summary: 'Ubiquitous 58mm cat and teddy bear continuous thermal pocket printers (0x51/0x78 Tiny protocol).',
        replacesApps: ['Tiny Print', 'iPrint'],
        playStoreUrl: 'https://play.google.com/store/apps/details?id=com.frogtosea.tinyPrint',
        appStoreUrl: 'https://apps.apple.com/app/tiny-print/id1585952175'
    },
    {
        id: 'niimbot',
        name: 'NIIMBOT',
        developer: 'Wuhan Jingchen Intelligent Identification',
        brandColor: '#fc4840',
        brandPalette: ['#ffffff', '#fc4840', '#b6b6b6'],
        badgeLetter: 'N',
        popularModels: ['D11', 'D110', 'B21', 'B1', 'D101', 'B3S'],
        summary: 'Smart thermal label makers using smart RFID/die-cut labels and Niimbot protocol.',
        replacesApps: ['NIIMBOT'],
        playStoreUrl: 'https://play.google.com/store/apps/details?id=com.gengcon.android.jccloudprinter',
        appStoreUrl: 'https://apps.apple.com/app/niimbot/id1359104615'
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
        appStoreUrl: 'https://apps.apple.com/app/print-master/id1467113436'
    },
    {
        id: 'phomemo',
        name: 'Phomemo',
        developer: 'Zhuhai Quin Technology Co., Ltd.',
        brandColor: '#fe677c',
        brandPalette: ['#ffffff', '#fe677c', '#fc3f54'],
        badgeLetter: 'P',
        popularModels: ['M02', 'M04', 'T02', 'M02S', 'M110'],
        summary: 'Popular thermal printers spanning portable pocket note printers (M02) and versatile label printers.',
        replacesApps: ['Phomemo', 'Print Master'],
        isMultiDevice: true,
        playStoreUrl: 'https://play.google.com/store/apps/details?id=com.quyin.phomemo',
        appStoreUrl: 'https://apps.apple.com/app/phomemo/id1456102145'
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
        appStoreUrl: 'https://apps.apple.com/app/fun-print/id1592740556'
    },
    {
        id: 'walkprint',
        name: 'WalkPrint',
        developer: 'WalkPrint / efercro Team',
        brandColor: '#8073f7',
        brandPalette: ['#ffffff', '#8073f7'],
        badgeLetter: 'W',
        popularModels: ['MXW01', 'V5G', 'MX05'],
        summary: 'Portable thermal pocket and receipt printers using WalkPrint / V5X bulk raster protocol.',
        replacesApps: ['WalkPrint'],
        playStoreUrl: 'https://play.google.com/store/apps/details?id=com.yhk.rabbit.print.walkprint',
        appStoreUrl: 'https://apps.apple.com/app/walkprint/id1491753561'
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
        appStoreUrl: 'https://apps.apple.com/app/peripage/id1508457132'
    },
    {
        id: 'flashlabel',
        name: 'FlashLabel',
        developer: 'Xiamen Angyin Information Technology',
        brandColor: '#1d5a9d',
        brandPalette: ['#ffffff', '#1d5a9d', '#429afd'],
        badgeLetter: 'F',
        popularModels: ['Orgsta S001', 'Y486', 'A318'],
        summary: 'Desktop shipping and thermal barcode printers using TSPL/CPCL protocol.',
        replacesApps: ['FlashLabel', 'Orgsta'],
        playStoreUrl: 'https://play.google.com/store/apps/details?id=cn.angyin.flashlabel',
        appStoreUrl: 'https://apps.apple.com/app/flashlabel/id1619933168'
    },
    {
        id: 'labelife',
        name: 'Labelife',
        developer: 'AIMO Tech / Zhuhai Quin',
        brandColor: '#3d81f8',
        brandPalette: ['#ffffff', '#3d81f8'],
        badgeLetter: 'L',
        popularModels: ['PM-241', 'PM-241BT', 'D520'],
        summary: 'Wide desktop commercial shipping label printers communicating via TSPL commands.',
        replacesApps: ['Labelife', 'Phomemo'],
        playStoreUrl: 'https://play.google.com/store/apps/details?id=com.aimo.labelife',
        appStoreUrl: 'https://apps.apple.com/app/labelife/id1560922539'
    },
    {
        id: 'munbyn_print',
        name: 'Munbyn Print',
        developer: 'MUNBYN / SYZ',
        brandColor: '#ff4713',
        brandPalette: ['#ffffff', '#ff4713'],
        badgeLetter: 'M',
        popularModels: ['ITPP941', 'RW401AP', 'Realwriter 941', 'ITPP130'],
        summary: 'Commercial shipping and thermal barcode label printers using TSPL/CPCL protocol.',
        replacesApps: ['Munbyn Print', 'Munbyn'],
        playStoreUrl: 'https://play.google.com/store/apps/details?id=com.syz.mprint',
        appStoreUrl: 'https://apps.apple.com/app/munbyn-print/id1629319392'
    },
    {
        id: 'luck_jingle',
        name: 'Luck Jingle',
        developer: 'Xiamen Lujiang Technology Co., Ltd.',
        brandColor: '#0670e8',
        brandPalette: ['#0670e8', '#ffcd34', '#ffffff', '#000000'],
        badgeLetter: 'L',
        popularModels: ['L13', 'L12', 'DPS1', 'D80', 'A80', 'ITP05'],
        summary: 'Portable Bluetooth thermal label makers and mini pocket printers using the LuckPrinter ESC/POS and flow-control protocol.',
        replacesApps: ['Luck Jingle', 'LuckPrinter'],
        playStoreUrl: 'https://play.google.com/store/apps/details?id=com.dingdang.newprint',
        appStoreUrl: 'https://apps.apple.com/app/luck-jingle/id1533722247'
    },
    {
        id: 'iprint',
        name: 'iPrint',
        developer: 'FrogToSea / iPrint Team',
        brandColor: '#2b7cad',
        brandPalette: ['#2b7cad', '#1c5f9b', '#ffffff', '#000000'],
        badgeLetter: 'I',
        popularModels: ['GB01', 'GT08', 'JXM800', 'X8', 'GW08', 'C9'],
        summary: 'Ubiquitous 58mm pocket printers, 15mm label printers, and A4 stencil/tattoo printers using the 51 78 Tiny protocol.',
        replacesApps: ['iPrint', 'Tiny Print'],
        playStoreUrl: 'https://play.google.com/store/apps/details?id=com.frogtosea.iprint'
    },
    {
        id: 'dolewa',
        name: 'Dolewa',
        developer: 'Dolewa Technology',
        brandColor: '#06c9da',
        brandPalette: ['#06c9da', '#e78d14', '#60d4df', '#000000'],
        badgeLetter: 'D',
        popularModels: ['BH-01', 'A80', 'D80', 'DL-T1', 'M8'],
        summary: 'Portable A4 tattoo printers, pocket memo cameras, and label makers using Funny LX-D and ESC/POS raster protocols.',
        replacesApps: ['Dolewa', 'Dolewa Camera', 'Dolewa A4 Printer'],
        playStoreUrl: 'https://play.google.com/store/apps/details?id=com.dolewa&hl=gsw'
    }
];
