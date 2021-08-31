import type { PageEntity } from "@logseq/libs/dist/LSPlugin";

export type ITabInfo = PageEntity & {
  pinned?: boolean;
  scrollTop?: number;
};
