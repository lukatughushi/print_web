// Translations for catalogue data that comes from the database: product
// names, descriptions and materials. Seeded names follow two patterns —
// "<style> <category>" and "<category> „<collection>“" — so they are
// translated piece by piece; anything unknown stays as typed in the admin.

const CATEGORY = {
  'მაისური': ['T-Shirt', 'Футболка'],
  'პოლო': ['Polo', 'Поло'],
  'გრძელმკლავიანი მაისური': ['Long Sleeve T-Shirt', 'Лонгслив'],
  'გრძელმკლავიანი პოლო': ['Long Sleeve Polo', 'Поло с длинным рукавом'],
  'ჰუდი ჯიბით': ['Pocket Hoodie', 'Худи с карманом'],
  'ჰუდი ელვით': ['Zip Hoodie', 'Худи на молнии'],
  'ბომბერი': ['Bomber', 'Бомбер'],
  'ჩანთა': ['Tote Bag', 'Сумка'],
  'კეპი': ['Cap', 'Кепка'],
  'ჭიქა': ['Mug', 'Кружка'],
  'ბალიშის პირი': ['Pillowcase', 'Наволочка'],
};

// English goes before the category ("Oversize T-Shirt"); Russian after it,
// in forms that need no gender agreement ("Футболка оверсайз").
const STYLE = {
  'კლასიკური': ['Classic', 'классик'],
  'ოვერსაიზ': ['Oversize', 'оверсайз'],
  'ბეისიქ': ['Basic', 'бейсик'],
  'პრემიუმ': ['Premium', 'премиум'],
  'სლიმ ფიტი': ['Slim Fit', 'слим-фит'],
  'სპორტული': ['Sport', 'спорт'],
  'მძიმე ბამბის': ['Heavyweight', 'из плотного хлопка'],
  'რეგულარ ფიტი': ['Regular Fit', 'регуляр-фит'],
  'V-ყელით': ['V-Neck', 'с V-вырезом'],
  'ქალის': ["Women's", 'для женщин'],
  'პიკე': ['Piqué', 'пике'],
  'კორპორატიული': ['Corporate', 'для команды'],
  'ზოლიანი საყელოთი': ['Striped Collar', 'с полосатым воротником'],
  'ჯიბით': ['Pocket', 'с карманом'],
  'რეგლანი': ['Raglan', 'реглан'],
  'მანჟეტით': ['Cuffed', 'с манжетами'],
  'ზამთრის': ['Winter', 'на зиму'],
  'მძიმე': ['Heavy', 'из плотной ткани'],
  'ქუჩის': ['Street', 'стритвир'],
  'რბილი ფლისის': ['Soft Fleece', 'из мягкого флиса'],
  'ურბან': ['Urban', 'урбан'],
  'სატინის': ['Satin', 'из сатина'],
  'კოლეჯის': ['College', 'колледж'],
  'მსუბუქი': ['Lightweight', 'лайт'],
  'დიდი': ['Large', 'большого размера'],
  'ეკო': ['Eco', 'эко'],
  'ელვით': ['Zip', 'на молнии'],
  'მოკლე სახელურით': ['Short Handle', 'с короткими ручками'],
  'შოპერი': ['Shopper', 'шопер'],
  'მძიმე კანვასის': ['Heavy Canvas', 'из плотного канваса'],
  'მინი': ['Mini', 'мини'],
  'საყიდლების': ['Shopping', 'для покупок'],
  'ბეისბოლის': ['Baseball', 'бейсбол'],
  'დად ქეფი': ['Dad', 'dad cap'],
  'სნეპბექი': ['Snapback', 'снэпбэк'],
  'ტრაკერი': ['Trucker', 'тракер'],
  'ექვსპანელიანი': ['6-Panel', '6 панелей'],
  'რბილი': ['Soft', 'софт'],
  'ხუთპანელიანი': ['5-Panel', '5 панелей'],
  'კლასიკური 330 მლ': ['Classic 330 ml', 'классик 330 мл'],
  'დიდი 450 მლ': ['Large 450 ml', '450 мл'],
  'ფერადი შიგნით': ['Colour-Inside', 'с цветной серединой'],
  'მატოვი': ['Matte', 'матовая'],
  'ლატე': ['Latte', 'латте'],
  'ესპრესოს': ['Espresso', 'для эспрессо'],
  'თერმო': ['Thermo', 'термо'],
  'ფერადი სახელურით': ['Colour-Handle', 'с цветной ручкой'],
  'საჩუქრის': ['Gift', 'в подарок'],
  'ოფისის': ['Office', 'для офиса'],
};

const COLLECTION = {
  'თბილისი': ['Tbilisi', 'Тбилиси'],
  'კავკასია': ['Caucasus', 'Кавказ'],
  'მთაწმინდა': ['Mtatsminda', 'Мтацминда'],
  'ბათუმი': ['Batumi', 'Батуми'],
  'სვანეთი': ['Svaneti', 'Сванетия'],
  'ანბანი': ['Alphabet', 'Алфавит'],
  'ვაზი': ['Vine', 'Лоза'],
  'ღამის ქალაქი': ['Night City', 'Ночной город'],
  'ზღვა': ['Sea', 'Море'],
  'მზე': ['Sun', 'Солнце'],
};

const TEXT = {
  // Materials
  '100% ბამბა': ['100% cotton', '100% хлопок'],
  'ორგანული ბამბა': ['Organic cotton', 'Органический хлопок'],
  'ბამბა / პოლიესტერი 60/40': ['Cotton / polyester 60/40', 'Хлопок / полиэстер 60/40'],
  'პიკე ბამბა': ['Piqué cotton', 'Хлопок пике'],
  'ბამბა / პოლიესტერი 65/35': ['Cotton / polyester 65/35', 'Хлопок / полиэстер 65/35'],
  'ფლისი 80/20': ['Fleece 80/20', 'Флис 80/20'],
  '100% ბამბის ფუტერი': ['100% cotton French terry', 'Футер, 100% хлопок'],
  'ორგანული ფლისი': ['Organic fleece', 'Органический флис'],
  'ნეილონი, საფენით': ['Nylon, lined', 'Нейлон, с подкладкой'],
  'სატინი': ['Satin', 'Сатин'],
  'პოლიესტერი, საფენით': ['Polyester, lined', 'Полиэстер, с подкладкой'],
  'კანვასი 280 გ/მ²': ['Canvas 280 g/m²', 'Канвас 280 г/м²'],
  'ბამბა 140 გ/მ²': ['Cotton 140 g/m²', 'Хлопок 140 г/м²'],
  'ორგანული კანვასი': ['Organic canvas', 'Органический канвас'],
  'ტვილი ბამბა': ['Cotton twill', 'Хлопковый твил'],
  'პოლიესტერი': ['Polyester', 'Полиэстер'],
  'ბამბა / პოლიესტერი': ['Cotton / polyester', 'Хлопок / полиэстер'],
  'კერამიკა': ['Ceramic', 'Керамика'],
  // Descriptions
  'რბილი, ჰაერგამტარი ქსოვილი ყოველდღიური ტარებისთვის. იდეალურია DTF ბეჭდვისთვის.':
    ['Soft, breathable fabric for everyday wear. Ideal for DTF printing.', 'Мягкая дышащая ткань на каждый день. Идеальна для DTF-печати.'],
  'საყელოიანი პოლო ღილებით — კარგი არჩევანია გუნდისა და ოფისისთვის.':
    ['A collared polo with buttons — a great choice for teams and the office.', 'Поло с воротником на пуговицах — отличный выбор для команды и офиса.'],
  'გრძელი სახელოები და რბილი მანჟეტი — გარდამავალი სეზონისთვის.':
    ['Long sleeves and soft cuffs — made for the in-between season.', 'Длинные рукава и мягкие манжеты — для межсезонья.'],
  'გრძელმკლავიანი პოლო საყელოთი — ოფიციალური და ამავდროულად კომფორტული.':
    ['A long sleeve polo with a collar — smart and comfortable at once.', 'Поло с длинным рукавом и воротником — строго и удобно одновременно.'],
  'თბილი ჰუდი კენგურუს ჯიბით და კაპიუშონით. შიგნით რბილი ფლისი.':
    ['A warm hoodie with a kangaroo pocket and hood. Soft fleece inside.', 'Тёплое худи с карманом-кенгуру и капюшоном. Внутри мягкий флис.'],
  'ელვაშესაკრავი, ორი გვერდითი ჯიბე და ზონრები კაპიუშონზე.':
    ['Full zip, two side pockets and a drawstring hood.', 'Молния, два боковых кармана и капюшон на шнурках.'],
  'ბომბერი რეზინიანი საყელოთი და მანჟეტებით. ბეჭდვა ზურგზე და მკერდზე.':
    ['A bomber with a ribbed collar and cuffs. Print on the back and chest.', 'Бомбер с трикотажным воротником и манжетами. Печать на спине и груди.'],
  'მტკიცე ტილოს ჩანთა გრძელი სახელურებით. ბეჭდვა ორივე მხარეს.':
    ['A sturdy canvas tote with long handles. Print on both sides.', 'Прочная сумка из канваса с длинными ручками. Печать с обеих сторон.'],
  'რეგულირებადი ზომის კეპი. ბეჭდვა ან ნაქარგი წინა პანელზე.':
    ['An adjustable cap. Print or embroidery on the front panel.', 'Кепка с регулируемым размером. Печать или вышивка на передней панели.'],
  'კერამიკული ჭიქა სუბლიმაციური ბეჭდვით. ირეცხება ჭურჭლის სარეცხ მანქანაში.':
    ['A ceramic mug with sublimation print. Dishwasher safe.', 'Керамическая кружка с сублимационной печатью. Можно мыть в посудомоечной машине.'],
};

const IDX = { en: 0, ru: 1 };
const CATS_LONGEST_FIRST = Object.keys(CATEGORY).sort((a, b) => b.length - a.length);

/** A product name in the chosen language (Georgian names pass through). */
export function productName(name, lang) {
  const i = IDX[lang];
  if (i === undefined || !name) return name;
  if (CATEGORY[name]) return CATEGORY[name][i];

  // "<category> „<collection>“"
  const quoted = /^(.+?) „(.+)“$/.exec(name);
  if (quoted && CATEGORY[quoted[1]]) {
    const coll = COLLECTION[quoted[2]]?.[i] ?? quoted[2];
    return lang === 'ru' ? `${CATEGORY[quoted[1]][i]} «${coll}»` : `${CATEGORY[quoted[1]][i]} “${coll}”`;
  }

  // "<style> <category>"
  for (const cat of CATS_LONGEST_FIRST) {
    if (name.endsWith(` ${cat}`)) {
      const style = STYLE[name.slice(0, -cat.length - 1)];
      if (!style) break;
      return lang === 'ru' ? `${CATEGORY[cat][i]} ${style[i]}` : `${style[i]} ${CATEGORY[cat][i]}`;
    }
  }
  return name;
}

/** Description / material from the catalogue in the chosen language. */
export function productText(text, lang) {
  const i = IDX[lang];
  if (i === undefined || !text) return text;
  return TEXT[text]?.[i] ?? text;
}
