import defs from "../constants/architecture_defs.json";

export const NODE_CARD_WIDTH = 208;
export const NODE_CARD_MIN_HEIGHT = 50;

// 色定義の型
interface NodeStyle {
  category: string;
  bg: string;
  border: string;
  badge: string;
}

// JSONからスタイル定義を格納するマップ
const STYLE_MAP: Record<string, NodeStyle> = {};

// デフォルトスタイル
const DEFAULT_STYLE: NodeStyle = {
  category: 'other',
  bg: "#ffffff",
  border: "#777777",
  badge: "#eeeeee",
};

if (defs && Array.isArray(defs.categories)) {
  defs.categories.forEach((category) => {
    const { color, bgColor } = category;

    category.items.forEach((item) => {
      // item.type をキーにしてスタイルを登録
      STYLE_MAP[item.type] = {
        category: category.id,
        bg: bgColor,
        border: color,
        // バッジの背景もノード背景と同じ（あるいは必要に応じて変更）に設定
        badge: bgColor,
      };
    });
  });
}

/**
 * ノードのスタイルを取得する関数
 * architecture_defs.json の定義を基にスタイルを返します
 * @param type コンポーネント種別 (例: "Web Server", "DNS (Route53)")
 * @param customColor ユーザー指定色（あれば優先）
 */
export const getNodeStyle = (type: string, customColor?: string): NodeStyle => {
  // ユーザー指定色がある場合、それをベースにしたスタイルを返す
  if (customColor) {
    return {
      category: STYLE_MAP[type]?.category ?? 'other',
      bg: customColor,
      border: "#333333",
      badge: "rgba(255,255,255,0.5)",
    };
  }

  // 生成したマップから検索し、見つからない場合はデフォルトを返す
  return STYLE_MAP[type] || DEFAULT_STYLE;
};
