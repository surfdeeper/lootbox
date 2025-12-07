import { ItemCategory, CATEGORY_ICONS } from "../types";

interface ItemIconProps {
  category: ItemCategory;
  color: string;
  size?: number;
}

export function ItemIcon({ category, color, size = 32 }: ItemIconProps) {
  const path = CATEGORY_ICONS[category];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="item-icon"
      style={{
        filter: `drop-shadow(0 0 4px ${color})`,
      }}
    >
      <path d={path} />
    </svg>
  );
}
