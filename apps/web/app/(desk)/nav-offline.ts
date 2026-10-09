/** Inbox and Org read server env on each request, so an offline click cannot fall through to the browser. */
export function shouldHoldDynamicDeskNav(href: string, online: boolean, fetchThrew: boolean): boolean {
  if (href !== "/inbox" && href !== "/org") return false;
  return !online || fetchThrew;
}
