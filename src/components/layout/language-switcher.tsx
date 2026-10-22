import { ChevronDown, Languages } from "lucide-react";
import DropdownMenu from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { assertIsLocale, getLocale, setLocale } from "@/paraglide/runtime";

const LOCALES = [
  { value: "zh", label: "中文" },
  { value: "en", label: "English" },
];

export function LanguageSwitcher({ className }: { className: string }) {
  return (
    <DropdownMenu
      value={getLocale()}
      options={LOCALES}
      onChange={(locale) => setLocale(assertIsLocale(locale))}
      ariaLabel={m.common_switch_language()}
      triggerClassName={cn("group", className)}
      trigger={
        <>
          <Languages
            size={18}
            strokeWidth={1.5}
            className="transition-transform group-hover:scale-110"
          />
          <ChevronDown
            size={12}
            className="ml-1 opacity-70 transition-transform duration-200 group-aria-expanded:rotate-180"
          />
        </>
      }
    />
  );
}
