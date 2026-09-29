import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { loadPublicLoginExperience, loadPublicSite } from "./public-site.server.ts";

export const getPublicSiteExperience = createServerFn({ method: "GET" }).handler(async () => {
  return loadPublicSite(getRequestHost());
});

export const getPublicLoginExperience = createServerFn({ method: "GET" }).handler(async () => {
  return loadPublicLoginExperience(getRequestHost());
});
