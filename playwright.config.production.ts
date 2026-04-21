import { defineConfig } from "@playwright/test";
import { productionConfig } from "./playwright.config.production-base";

export default defineConfig(productionConfig);
