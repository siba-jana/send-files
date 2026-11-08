import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEFAULT_LOCALE, isSupportedLocale } from "@/i18n/locales";

export default async function ChatGptToPdfRoot({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const cookieStore = await cookies();
  const savedLocale = cookieStore.get("NEXT_LOCALE")?.value;
  const locale =
    savedLocale && isSupportedLocale(savedLocale) ? savedLocale : DEFAULT_LOCALE;

  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (typeof val === "string") qs.set(key, val);
    else if (Array.isArray(val)) val.forEach((v) => qs.append(key, v));
  }
  const searchStr = qs.toString();
  redirect(`/${locale}/chatgpt-to-pdf${searchStr ? `?${searchStr}` : ""}`);
}

