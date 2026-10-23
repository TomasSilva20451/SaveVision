import { cookies } from "next/headers";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { isDarkThemeCookie, THEME_COOKIE } from "@/lib/ui/theme";

export async function ThemeToggleSlot() {
  const cookieStore = await cookies();
  const initialDark = isDarkThemeCookie(cookieStore.get(THEME_COOKIE)?.value);
  return <ThemeToggle initialDark={initialDark} />;
}
