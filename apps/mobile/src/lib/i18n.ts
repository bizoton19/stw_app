import { getLocales } from "expo-localization";
import { I18n } from "i18n-js";

/**
 * Device-locale strings for iOS / Android / web.
 * Falls back to English when a key or language is missing.
 */
const translations = {
  en: {
    "items.kicker": "The drinks",
    "items.title": "Does this look right?",
    "items.empty": "Nothing came through. Add what was on the check.",
    "items.itemName": "Item name",
    "items.qty": "qty",
    "items.amt": "amt",
    "items.addLine": "Add a line",
    "items.subtotal": "Items %{amount}",
    "items.looksGood": "Looks good",
    "items.remove": "Remove %{name}",
    "items.line": "line",
    "brand.name": "Split the Wine",
  },
  es: {
    "items.kicker": "Las bebidas",
    "items.title": "¿Esto se ve bien?",
    "items.empty": "No salió nada. Añade lo que había en la cuenta.",
    "items.itemName": "Nombre del ítem",
    "items.qty": "cant.",
    "items.amt": "monto",
    "items.addLine": "Añadir línea",
    "items.subtotal": "Ítems %{amount}",
    "items.looksGood": "Se ve bien",
    "items.remove": "Quitar %{name}",
    "items.line": "línea",
    "brand.name": "Split the Wine",
  },
  fr: {
    "items.kicker": "Les boissons",
    "items.title": "Ça vous paraît juste ?",
    "items.empty": "Rien n’est passé. Ajoutez ce qui était sur l’addition.",
    "items.itemName": "Nom de l’article",
    "items.qty": "qté",
    "items.amt": "mt",
    "items.addLine": "Ajouter une ligne",
    "items.subtotal": "Articles %{amount}",
    "items.looksGood": "C’est bon",
    "items.remove": "Retirer %{name}",
    "items.line": "ligne",
    "brand.name": "Split the Wine",
  },
  de: {
    "items.kicker": "Die Getränke",
    "items.title": "Sieht das richtig aus?",
    "items.empty": "Nichts erkannt. Füge hinzu, was auf der Rechnung stand.",
    "items.itemName": "Artikelname",
    "items.qty": "Anz.",
    "items.amt": "Betr.",
    "items.addLine": "Zeile hinzufügen",
    "items.subtotal": "Artikel %{amount}",
    "items.looksGood": "Passt",
    "items.remove": "%{name} entfernen",
    "items.line": "Zeile",
    "brand.name": "Split the Wine",
  },
  pt: {
    "items.kicker": "As bebidas",
    "items.title": "Isto está certo?",
    "items.empty": "Nada veio. Adicione o que estava na conta.",
    "items.itemName": "Nome do item",
    "items.qty": "qtd",
    "items.amt": "val.",
    "items.addLine": "Adicionar linha",
    "items.subtotal": "Itens %{amount}",
    "items.looksGood": "Está bom",
    "items.remove": "Remover %{name}",
    "items.line": "linha",
    "brand.name": "Split the Wine",
  },
  it: {
    "items.kicker": "Le bevande",
    "items.title": "Ti sembra corretto?",
    "items.empty": "Non è uscito nulla. Aggiungi ciò che c’era sul conto.",
    "items.itemName": "Nome voce",
    "items.qty": "q.tà",
    "items.amt": "imp.",
    "items.addLine": "Aggiungi riga",
    "items.subtotal": "Voci %{amount}",
    "items.looksGood": "Va bene",
    "items.remove": "Rimuovi %{name}",
    "items.line": "riga",
    "brand.name": "Split the Wine",
  },
  ja: {
    "items.kicker": "ドリンク",
    "items.title": "内容は合っていますか？",
    "items.empty": "読み取れませんでした。チェックの内容を追加してください。",
    "items.itemName": "品名",
    "items.qty": "数量",
    "items.amt": "金額",
    "items.addLine": "行を追加",
    "items.subtotal": "小計 %{amount}",
    "items.looksGood": "これで進む",
    "items.remove": "%{name} を削除",
    "items.line": "行",
    "brand.name": "Split the Wine",
  },
  zh: {
    "items.kicker": "酒水",
    "items.title": "这样对吗？",
    "items.empty": "没有识别到内容。请添加账单上的项目。",
    "items.itemName": "品名",
    "items.qty": "数量",
    "items.amt": "金额",
    "items.addLine": "添加一行",
    "items.subtotal": "小计 %{amount}",
    "items.looksGood": "看起来没问题",
    "items.remove": "删除 %{name}",
    "items.line": "行",
    "brand.name": "Split the Wine",
  },
  ko: {
    "items.kicker": "음료",
    "items.title": "맞나요?",
    "items.empty": "인식된 항목이 없습니다. 영수증 내용을 추가하세요.",
    "items.itemName": "항목 이름",
    "items.qty": "수량",
    "items.amt": "금액",
    "items.addLine": "줄 추가",
    "items.subtotal": "항목 %{amount}",
    "items.looksGood": "좋아요",
    "items.remove": "%{name} 삭제",
    "items.line": "줄",
    "brand.name": "Split the Wine",
  },
} as const;

export type TranslationKey = keyof (typeof translations)["en"];

const i18n = new I18n(translations);
i18n.enableFallback = true;
i18n.defaultLocale = "en";

function deviceLanguageCode(): string {
  const code = getLocales()[0]?.languageCode?.toLowerCase();
  if (!code) return "en";
  if (code in translations) return code;
  // zh-Hans / zh-Hant → zh
  if (code.startsWith("zh")) return "zh";
  return "en";
}

i18n.locale = deviceLanguageCode();

export function t(key: TranslationKey, options?: Record<string, string | number>): string {
  return i18n.t(key, options);
}

export function refreshLocaleFromDevice(): string {
  i18n.locale = deviceLanguageCode();
  return i18n.locale;
}

export function currentLocale(): string {
  return i18n.locale;
}

export { i18n };
