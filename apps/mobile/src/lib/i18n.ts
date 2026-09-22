import { getLocales } from "expo-localization";
import { I18n } from "i18n-js";

type Dict = {
  items: {
    kicker: string;
    title: string;
    empty: string;
    itemName: string;
    nameLabel: string;
    qty: string;
    amt: string;
    addLine: string;
    subtotal: string;
    looksGood: string;
    no: string;
    inaccuracies: string;
    needRemove: string;
    tipInaccuracies: string;
    tipRemove: string;
    remove: string;
    line: string;
  };
  fees: {
    kicker: string;
    title: string;
    lead: string;
    nameLabel: string;
    amt: string;
    feeName: string;
    add: string;
    grand: string;
    continue: string;
    remove: string;
    fee: string;
  };
};

const translations: Record<string, Dict> = {
  en: {
    items: {
      kicker: "The drinks",
      title: "Does this look right?",
      empty: "Nothing came through. Add what was on the check.",
      itemName: "Item name",
      nameLabel: "item",
      qty: "qty",
      amt: "amt",
      addLine: "Add a line",
      subtotal: "Items %{amount}",
      looksGood: "Looks good",
      no: "No",
      inaccuracies: "There are inaccuracies",
      needRemove: "Yes but I need to remove some items",
      tipInaccuracies: "Edit any name, qty, or amount below — then tap Looks good.",
      tipRemove: "Tap the trash on any line you don't want — then tap Looks good.",
      remove: "Remove %{name}",
      line: "line",
    },
    fees: {
      kicker: "Tax & tip",
      title: "These follow what people ordered.",
      lead: "Admin, gratuity, tax — never an even split by headcount.",
      nameLabel: "fee",
      amt: "amt",
      feeName: "Fee name",
      add: "Add a fee",
      grand: "Grand %{amount}",
      continue: "Continue",
      remove: "Remove %{name}",
      fee: "fee",
    },
  },
  es: {
    items: {
      kicker: "Las bebidas",
      title: "¿Esto se ve bien?",
      empty: "No salió nada. Añade lo que había en la cuenta.",
      itemName: "Nombre del ítem",
      nameLabel: "ítem",
      qty: "cant.",
      amt: "monto",
      addLine: "Añadir línea",
      subtotal: "Ítems %{amount}",
      looksGood: "Se ve bien",
      no: "No",
      inaccuracies: "Hay imprecisiones",
      needRemove: "Sí, pero necesito quitar algunos ítems",
      tipInaccuracies: "Edita nombre, cantidad o monto abajo — luego toca Se ve bien.",
      tipRemove: "Toca el basurero en la línea que no quieras — luego Se ve bien.",
      remove: "Quitar %{name}",
      line: "línea",
    },
    fees: {
      kicker: "Impuestos y propina",
      title: "Esto sigue lo que pidió cada uno.",
      lead: "Admin, propina, impuestos — nunca a partes iguales por cabeza.",
      nameLabel: "cargo",
      amt: "monto",
      feeName: "Nombre del cargo",
      add: "Añadir cargo",
      grand: "Total %{amount}",
      continue: "Continuar",
      remove: "Quitar %{name}",
      fee: "cargo",
    },
  },
  fr: {
    items: {
      kicker: "Les boissons",
      title: "Ça vous paraît juste ?",
      empty: "Rien n’est passé. Ajoutez ce qui était sur l’addition.",
      itemName: "Nom de l’article",
      nameLabel: "article",
      qty: "qté",
      amt: "mt",
      addLine: "Ajouter une ligne",
      subtotal: "Articles %{amount}",
      looksGood: "C’est bon",
      no: "Non",
      inaccuracies: "Il y a des erreurs",
      needRemove: "Oui, mais je dois retirer des articles",
      tipInaccuracies: "Modifiez nom, qté ou montant ci-dessous — puis C’est bon.",
      tipRemove: "Touchez la corbeille sur une ligne à retirer — puis C’est bon.",
      remove: "Retirer %{name}",
      line: "ligne",
    },
    fees: {
      kicker: "Taxes et pourboire",
      title: "Ils suivent ce que chacun a commandé.",
      lead: "Frais, pourboire, taxe — jamais un partage égal par tête.",
      nameLabel: "frais",
      amt: "mt",
      feeName: "Nom des frais",
      add: "Ajouter des frais",
      grand: "Total %{amount}",
      continue: "Continuer",
      remove: "Retirer %{name}",
      fee: "frais",
    },
  },
  de: {
    items: {
      kicker: "Die Getränke",
      title: "Sieht das richtig aus?",
      empty: "Nichts erkannt. Füge hinzu, was auf der Rechnung stand.",
      itemName: "Artikelname",
      nameLabel: "Artikel",
      qty: "Anz.",
      amt: "Betr.",
      addLine: "Zeile hinzufügen",
      subtotal: "Artikel %{amount}",
      looksGood: "Passt",
      no: "Nein",
      inaccuracies: "Es gibt Ungenauigkeiten",
      needRemove: "Ja, aber ich muss einige Positionen entfernen",
      tipInaccuracies: "Namen, Menge oder Betrag unten anpassen — dann Passt.",
      tipRemove: "Mülltonne tippen, um eine Zeile zu entfernen — dann Passt.",
      remove: "%{name} entfernen",
      line: "Zeile",
    },
    fees: {
      kicker: "Steuer & Trinkgeld",
      title: "Das folgt dem, was bestellt wurde.",
      lead: "Gebühren, Trinkgeld, Steuer — nie gleichmäßig pro Kopf.",
      nameLabel: "Gebühr",
      amt: "Betr.",
      feeName: "Gebührenname",
      add: "Gebühr hinzufügen",
      grand: "Gesamt %{amount}",
      continue: "Weiter",
      remove: "%{name} entfernen",
      fee: "Gebühr",
    },
  },
  pt: {
    items: {
      kicker: "As bebidas",
      title: "Isto está certo?",
      empty: "Nada veio. Adicione o que estava na conta.",
      itemName: "Nome do item",
      nameLabel: "item",
      qty: "qtd",
      amt: "val.",
      addLine: "Adicionar linha",
      subtotal: "Itens %{amount}",
      looksGood: "Está bom",
      no: "Não",
      inaccuracies: "Há imprecisões",
      needRemove: "Sim, mas preciso remover alguns itens",
      tipInaccuracies: "Edite nome, qtd ou valor abaixo — depois Está bom.",
      tipRemove: "Toque no lixo na linha que não quiser — depois Está bom.",
      remove: "Remover %{name}",
      line: "linha",
    },
    fees: {
      kicker: "Taxa e gorjeta",
      title: "Isto segue o que cada um pediu.",
      lead: "Taxa, gorjeta, imposto — nunca divisão igual por cabeça.",
      nameLabel: "taxa",
      amt: "val.",
      feeName: "Nome da taxa",
      add: "Adicionar taxa",
      grand: "Total %{amount}",
      continue: "Continuar",
      remove: "Remover %{name}",
      fee: "taxa",
    },
  },
  it: {
    items: {
      kicker: "Le bevande",
      title: "Ti sembra corretto?",
      empty: "Non è uscito nulla. Aggiungi ciò che c’era sul conto.",
      itemName: "Nome voce",
      nameLabel: "voce",
      qty: "q.tà",
      amt: "imp.",
      addLine: "Aggiungi riga",
      subtotal: "Voci %{amount}",
      looksGood: "Va bene",
      no: "No",
      inaccuracies: "Ci sono imprecisioni",
      needRemove: "Sì, ma devo rimuovere alcuni articoli",
      tipInaccuracies: "Modifica nome, q.tà o importo sotto — poi Va bene.",
      tipRemove: "Tocca il cestino sulla riga da togliere — poi Va bene.",
      remove: "Rimuovi %{name}",
      line: "riga",
    },
    fees: {
      kicker: "Tasse e mancia",
      title: "Seguono ciò che è stato ordinato.",
      lead: "Spese, mancia, tasse — mai a parti uguali per testa.",
      nameLabel: "voce",
      amt: "imp.",
      feeName: "Nome voce",
      add: "Aggiungi voce",
      grand: "Totale %{amount}",
      continue: "Continua",
      remove: "Rimuovi %{name}",
      fee: "voce",
    },
  },
  ja: {
    items: {
      kicker: "ドリンク",
      title: "内容は合っていますか？",
      empty: "読み取れませんでした。チェックの内容を追加してください。",
      itemName: "品名",
      nameLabel: "品名",
      qty: "数量",
      amt: "金額",
      addLine: "行を追加",
      subtotal: "小計 %{amount}",
      looksGood: "これで進む",
      no: "いいえ",
      inaccuracies: "誤りがあります",
      needRemove: "はい、でも一部の品目を削除したい",
      tipInaccuracies: "下の名前・数量・金額を直してから「これで進む」を押してください。",
      tipRemove: "不要な行のゴミ箱を押してから「これで進む」を押してください。",
      remove: "%{name} を削除",
      line: "行",
    },
    fees: {
      kicker: "税・チップ",
      title: "注文に応じて按分します。",
      lead: "手数料・チップ・税 — 人数割りではありません。",
      nameLabel: "費目",
      amt: "金額",
      feeName: "費目名",
      add: "費目を追加",
      grand: "合計 %{amount}",
      continue: "次へ",
      remove: "%{name} を削除",
      fee: "費目",
    },
  },
  zh: {
    items: {
      kicker: "酒水",
      title: "这样对吗？",
      empty: "没有识别到内容。请添加账单上的项目。",
      itemName: "品名",
      nameLabel: "品名",
      qty: "数量",
      amt: "金额",
      addLine: "添加一行",
      subtotal: "小计 %{amount}",
      looksGood: "看起来没问题",
      no: "否",
      inaccuracies: "有不准确的地方",
      needRemove: "对，但我需要删除一些项目",
      tipInaccuracies: "请在下方修改名称、数量或金额，然后点「看起来没问题」。",
      tipRemove: "点垃圾桶删除不需要的行，然后点「看起来没问题」。",
      remove: "删除 %{name}",
      line: "行",
    },
    fees: {
      kicker: "税与小费",
      title: "按各人点的内容分摊。",
      lead: "服务费、小费、税 — 不是按人头均分。",
      nameLabel: "费用",
      amt: "金额",
      feeName: "费用名称",
      add: "添加费用",
      grand: "合计 %{amount}",
      continue: "继续",
      remove: "删除 %{name}",
      fee: "费用",
    },
  },
  ko: {
    items: {
      kicker: "음료",
      title: "맞나요?",
      empty: "인식된 항목이 없습니다. 영수증 내용을 추가하세요.",
      itemName: "항목 이름",
      nameLabel: "항목",
      qty: "수량",
      amt: "금액",
      addLine: "줄 추가",
      subtotal: "항목 %{amount}",
      looksGood: "좋아요",
      no: "아니요",
      inaccuracies: "부정확한 부분이 있어요",
      needRemove: "맞지만 일부 항목을 지워야 해요",
      tipInaccuracies: "아래 이름·수량·금액을 고친 뒤 「좋아요」를 누르세요.",
      tipRemove: "지울 줄의 휴지통을 누른 뒤 「좋아요」를 누르세요.",
      remove: "%{name} 삭제",
      line: "줄",
    },
    fees: {
      kicker: "세금·팁",
      title: "주문한 내용에 따라 나눕니다.",
      lead: "수수료, 팁, 세금 — 인원수로 균등 분할하지 않습니다.",
      nameLabel: "요금",
      amt: "금액",
      feeName: "요금 이름",
      add: "요금 추가",
      grand: "합계 %{amount}",
      continue: "계속",
      remove: "%{name} 삭제",
      fee: "요금",
    },
  },
  ht: {
    items: {
      kicker: "Bwason yo",
      title: "Èske sa kòrèk?",
      empty: "Pa gen anyen. Ajoute sa ki te sou chèk la.",
      itemName: "Non atik",
      nameLabel: "atik",
      qty: "kant.",
      amt: "mont.",
      addLine: "Ajoute yon liy",
      subtotal: "Atik %{amount}",
      looksGood: "Sa bon",
      no: "Non",
      inaccuracies: "Gen erè ladan l",
      needRemove: "Wi, men mwen bezwen retire kèk atik",
      tipInaccuracies: "Korije non, kantite oswa pri anba a — epi peze Sa bon.",
      tipRemove: "Peze poubèl la sou liy ou pa vle a — epi peze Sa bon.",
      remove: "Retire %{name}",
      line: "liy",
    },
    fees: {
      kicker: "Takks ak tip",
      title: "Sa swiv sa moun yo te kòmande.",
      lead: "Admin, tip, taks — pa janm separe egal pou chak tèt.",
      nameLabel: "frè",
      amt: "mont.",
      feeName: "Non frè",
      add: "Ajoute yon frè",
      grand: "Total %{amount}",
      continue: "Kontinye",
      remove: "Retire %{name}",
      fee: "frè",
    },
  },
};

export type TranslationKey =
  | `items.${keyof Dict["items"]}`
  | `fees.${keyof Dict["fees"]}`;

const i18n = new I18n(translations);
i18n.enableFallback = true;
i18n.defaultLocale = "en";

function deviceLanguageCode(): string {
  const code = getLocales()[0]?.languageCode?.toLowerCase();
  if (!code) return "en";
  if (code in translations) return code;
  if (code.startsWith("zh")) return "zh";
  if (code === "cpf" || code === "hat") return "ht";
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
