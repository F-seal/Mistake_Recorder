import type { CategoryId } from "@/domain/constants";
import { CATEGORY_SHAPES } from "@/domain/constants";
import { useI18n } from "@/i18n/I18nProvider";

function shapeElement(category: CategoryId) {
  const shape = CATEGORY_SHAPES[category];
  switch (shape) {
    case "circle":
      return <circle cx="6" cy="6" r="4.4" />;
    case "diamond":
      return <path d="M6 1.2 10.8 6 6 10.8 1.2 6Z" />;
    case "square":
      return <rect x="1.6" y="1.6" width="8.8" height="8.8" rx="1.2" />;
    case "triangle":
      return <path d="M6 1.1 11.1 10.5H.9Z" />;
    case "hexagon":
      return <path d="M3.2 1.4h5.6L11.3 6l-2.5 4.6H3.2L.7 6Z" />;
  }
}

export function CategoryMark({
  category,
  size = 10,
  className = "",
}: {
  category: CategoryId;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`category-mark ${className}`.trim()}
      data-category={category}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 12 12" width={size} height={size} focusable="false">
        <g fill="currentColor">{shapeElement(category)}</g>
      </svg>
    </span>
  );
}

export function CategoryBadge({
  category,
  className = "",
}: {
  category: CategoryId;
  className?: string;
}) {
  const { copy } = useI18n();
  return (
    <span className={`category-badge ${className}`.trim()}>
      <CategoryMark category={category} size={8} />
      <span>{copy.categories[category]}</span>
    </span>
  );
}
